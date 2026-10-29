# Flujo de InstaYa! (guía de estudio)

## Idea general

```
Pantalla (React) → api.ts → /api/... → Express → [authenticate → requireRole → Zod → handler] → Prisma → PostgreSQL
                      └─ si VITE_DEMO=true → demoApi.ts (mismas reglas, datos en localStorage)
```

## Qué hace cada archivo

| Archivo | Para qué sirve |
|---|---|
| `backend/src/app.ts` | Arma la app Express (helmet, cors, json, rutas, 404, errores). No abre puerto. |
| `backend/src/server.ts` | Importa la app y hace `listen`. Separado para poder testear con Supertest. |
| `backend/src/config/env.ts` | Lee variables de entorno (puerto, JWT, URL del cliente, `PLATFORM_KEY`, `SOPORTE_CONTACTO`). |
| `backend/src/middleware/auth.ts` | `signToken`, `authenticate` (verifica JWT, consulta la BD, calcula el plan y bloquea escrituras con 402 si venció) y `requireRole`. |
| `backend/src/middleware/tenant.ts` | `tenantGuard`: rechaza un body con otra `empresaId` y fuerza la del usuario. |
| `backend/src/middleware/error.ts` | `AppError`, `notFound` y `errorHandler` (único lugar que traduce errores a HTTP). |
| `backend/src/lib/asyncHandler.ts` | Envuelve handlers async: cualquier error llega a `errorHandler` sin `try/catch`. |
| `backend/src/routes/*.ts` | Un archivo por módulo: auth, usuarios, empresa, productos (+ importar), movimientos, ventas, reportes, suscripcion, plataforma. |
| `backend/src/lib/suscripcion.ts` | Precios (15 días de prueba, $50, $10/mes) y reglas del plan: `calcularSuscripcion` y `extenderSuscripcion`. |
| `backend/src/routes/plataforma.ts` | Panel del dueño del SaaS: lista empresas y activa el plan BASICO por N meses. Se protege con `x-platform-key`. |
| `backend/prisma/schema.prisma` | Modelo de datos (Empresa, Usuario, Producto, MovimientoStock, Venta, VentaItem...). |
| `frontend/src/lib/api.ts` | Cliente HTTP: pone el token, maneja 401 y errores. Si `VITE_DEMO`, llama a `demoApi`. |
| `frontend/src/lib/demoApi.ts` | API simulada para la demo pública (localStorage). |
| `frontend/src/context/AuthContext.tsx` | Sesión: login, registro, logout, restaurar sesión con `/usuarios/me`. |
| `frontend/src/lib/xlsx.ts` | Lee y escribe `.xlsx` sin librerías (zip + XML, `DecompressionStream`). |
| `frontend/src/lib/hoja.ts` | Convierte filas de la hoja en productos: reconoce encabezados en español y valida cada fila. |
| `frontend/src/lib/pwa.ts` | Registra el service worker y maneja el botón "Instalar app". |
| `frontend/src/hooks/useData.ts` | Hook de lectura: pide un path, expone `data`, `cargando`, `error`, `recargar`. |

## Recorrido: login + tenant

1. `Login.tsx` → `AuthContext.login` → `POST /api/auth/login`.
2. `routes/auth.ts`: Zod valida email/contraseña → busca el usuario → revisa `activo` y `empresa.activa` → `bcrypt.compare`. Si falla, mismo mensaje "Credenciales inválidas" (no revela si el correo existe).
3. `signToken` firma un JWT con `sub`, `empresaId`, `rol`. El front lo guarda en `localStorage`.
4. En cada petición posterior `api.ts` manda `Authorization: Bearer <token>`.
5. `authenticate` verifica la firma **y vuelve a consultar la BD**: si el usuario o la empresa se desactivaron, el token deja de servir aunque no haya expirado.
6. Los handlers usan `req.user.empresaId` en todo `where`. Por eso pedir el producto de otra empresa da 404, no 403 (ni siquiera se revela que existe).

## Recorrido: registrar una venta con productos

1. `POST /api/ventas` con `items: [{ productoId, cantidad }]`.
2. Zod valida; `authenticate` pone `req.user`.
3. Se abre una transacción (`prisma.$transaction`). Por cada item: busca el producto **de mi empresa**, comprueba stock, suma `precioVenta × cantidad` (con `Prisma.Decimal`, no `Number`), descuenta stock y crea un `MovimientoStock` de tipo `SALIDA`.
4. Se crea la `Venta` con sus `VentaItem`. Si algo falla (producto ajeno, stock insuficiente) se lanza `AppError` y la transacción completa se revierte.
5. Anular (`/ventas/:id/anular`) hace lo inverso: repone stock, crea movimientos `ENTRADA` y marca `ANULADA`.

## Recorrido: plan y suscripción

1. `POST /api/auth/register` crea la empresa con `plan = PRUEBA` y `trialFin = hoy + 15 días`.
2. En cada petición, `authenticate` ya trae la empresa de la BD y llama a `calcularSuscripcion`: estado `PRUEBA`, `ACTIVA` o `VENCIDA`, días restantes y `soloLectura`.
3. Si `soloLectura` y el método es de escritura (POST/PUT/PATCH/DELETE), responde **402**. Las lecturas y exportaciones siguen funcionando: nunca se borran datos. `/api/suscripcion` queda libre para ver cómo pagar.
4. El cliente paga a mano (transferencia, Wompi o N1co). El operador llama a `POST /api/plataforma/empresas/:id/activar` con `{ meses }` y el header `x-platform-key`.
5. `extenderSuscripcion` suma los meses desde hoy, o desde el vencimiento actual si aún no ha llegado (pagar antes no hace perder días).
6. En el front, `Plan.tsx` y el aviso de `AppLayout` muestran el estado (aviso a 5 días o menos, o vencido).

## Recorrido: importar inventario desde Excel

1. `Importar.tsx`: el admin elige un `.xlsx` o `.csv` (o descarga la plantilla).
2. `xlsx.ts` lo lee en el navegador; `hoja.ts` mapea los encabezados en español ("Nombre", "Precio venta", "Stock"...) y valida cada fila. Se ve una vista previa con errores por fila.
3. `POST /api/productos/importar` con las filas. El backend vuelve a validar: **todo o nada**. Si una fila falla, no se guarda ninguna y se devuelven los errores con su número de fila.
4. Crea las categorías y proveedores que falten, actualiza el producto si ya existe (por SKU o por nombre) o lo crea, y registra movimientos `ENTRADA` o `AJUSTE` para que el stock tenga historial.

## Conceptos clave para entrevista

- **Multi-tenant (esquema compartido):** una sola BD, columna `empresaId` en todo, y todo `where` la incluye.
- **JWT + verificación en BD:** el token identifica; la BD decide si sigue siendo válido.
- **Transacción:** venta + stock + movimientos pasan juntos o no pasan.
- **Error handler central:** los handlers solo lanzan; un único middleware decide el código HTTP.
- **Solo lectura en vez de bloqueo:** el plan vencido no corta el acceso; solo impide registrar (402).
- **Todo o nada:** la importación valida todas las filas antes de escribir.
- **Tests sin BD:** Prisma se reemplaza por un doble; se prueban reglas (roles, aislamiento, stock), no SQL.

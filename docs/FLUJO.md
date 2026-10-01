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
| `backend/src/config/env.ts` | Lee variables de entorno (puerto, JWT, URL del cliente). |
| `backend/src/middleware/auth.ts` | `signToken`, `authenticate` (verifica JWT y consulta la BD) y `requireRole`. |
| `backend/src/middleware/tenant.ts` | `tenantGuard`: rechaza un body con otra `empresaId` y fuerza la del usuario. |
| `backend/src/middleware/error.ts` | `AppError`, `notFound` y `errorHandler` (único lugar que traduce errores a HTTP). |
| `backend/src/lib/asyncHandler.ts` | Envuelve handlers async: cualquier error llega a `errorHandler` sin `try/catch`. |
| `backend/src/routes/*.ts` | Un archivo por módulo: auth, usuarios, productos, movimientos, ventas, reportes. |
| `backend/prisma/schema.prisma` | Modelo de datos (Empresa, Usuario, Producto, MovimientoStock, Venta, VentaItem...). |
| `frontend/src/lib/api.ts` | Cliente HTTP: pone el token, maneja 401 y errores. Si `VITE_DEMO`, llama a `demoApi`. |
| `frontend/src/lib/demoApi.ts` | API simulada para la demo pública (localStorage). |
| `frontend/src/context/AuthContext.tsx` | Sesión: login, registro, logout, restaurar sesión con `/usuarios/me`. |
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

## Conceptos clave para entrevista

- **Multi-tenant (esquema compartido):** una sola BD, columna `empresaId` en todo, y todo `where` la incluye.
- **JWT + verificación en BD:** el token identifica; la BD decide si sigue siendo válido.
- **Transacción:** venta + stock + movimientos pasan juntos o no pasan.
- **Error handler central:** los handlers solo lanzan; un único middleware decide el código HTTP.
- **Tests sin BD:** Prisma se reemplaza por un doble; se prueban reglas (roles, aislamiento, stock), no SQL.

# Despliegue

> Estado: **la demo del frontend está publicada en https://instaya-demo.netlify.app; el backend aún no está desplegado.** Este documento es el plan, no un registro de algo que ya esté en producción.

## 1. Demo pública (sin servidor) — Netlify

El `netlify.toml` de la raíz ya compila `frontend/` con `VITE_DEMO=true`. Conectar el repositorio a Netlify es suficiente; no hay variables que configurar. Los datos viven en `localStorage` del navegador (`frontend/src/lib/demoApi.ts`).

## 2. Aplicación completa (API + PostgreSQL)

Las imágenes Docker ya se construyen en CI (`backend/Dockerfile`, `frontend/Dockerfile`). Para publicarlas hace falta un lugar donde correr un contenedor y una base de datos PostgreSQL administrada:

| Pieza | Opciones |
|---|---|
| Base de datos | Neon, Supabase (Postgres), Amazon RDS |
| API (contenedor) | Render, Fly.io, AWS App Runner / ECS Fargate |
| Web | Netlify / Vercel apuntando `/api` a la API, o la imagen nginx del frontend |

Variables de la API:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | cadena de conexión de PostgreSQL |
| `JWT_SECRET` | secreto largo y aleatorio (obligatorio cambiarlo) |
| `CLIENT_URL` | origen del frontend, para CORS |
| `ANTHROPIC_API_KEY` | opcional; activa el resumen con IA del asistente de reposición |
| `PLATFORM_KEY` | clave del operador para `/api/plataforma` (header `x-platform-key`). Larga y aleatoria; si falta, el panel responde 503 |
| `STATIC_DIR` | opcional; carpeta con el build del frontend para que la API sirva también la web (lo usa el instalador local, ver `local/LEEME.md`) |
| `SOPORTE_CONTACTO` | contacto que ve el cliente para pagar o pedir soporte (por defecto `soporte@instaya.app`) |

El contenedor del backend ejecuta `prisma migrate deploy` al arrancar, así que las migraciones se aplican solas en cada despliegue.

## 3. Despliegue gratuito elegido: Supabase + Render + Netlify

| Pieza | Servicio | Notas |
|---|---|---|
| PostgreSQL | Supabase (free) | usar la cadena del **Session pooler** (puerto 5432, IPv4). La conexión directa es solo IPv6 y Render no la alcanza; el Transaction pooler (6543) no sirve para `prisma migrate deploy`. El proyecto gratis se pausa tras 7 días sin uso |
| API | Render, Web Service con Docker (free) | Root Directory `backend`, Health Check `/api/health`. Se duerme tras 15 min sin uso: la primera petición tarda ~1 min |
| Web | Netlify, `instaya-app.netlify.app` | se compila **sin** `VITE_DEMO` y con `VITE_API_URL=https://<api>.onrender.com` |

El frontend llama directo a la API (`VITE_API_URL`) en vez de usar un proxy de Netlify, porque el proxy corta a los ~26 s y el arranque en frío de Render tarda más. Por eso `CLIENT_URL` de la API debe ser exactamente `https://instaya-app.netlify.app` (CORS).

## 4. Pasos para un primer despliegue

1. Crear la base de datos y copiar su `DATABASE_URL`.
2. Construir y subir la imagen del backend; configurar las variables de arriba.
3. Comprobar `GET /api/health` y `/api/docs`.
4. Publicar el frontend sin `VITE_DEMO` y con `VITE_API_URL` apuntando a la API.
5. Opcional: `npm run seed` una vez contra esa base para tener datos de demostración.
6. Al recibir un pago: `curl -X POST https://<api>/api/plataforma/empresas/<id>/activar -H "x-platform-key: $PLATFORM_KEY" -H "Content-Type: application/json" -d '{"meses":1}'`.

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

El contenedor del backend ejecuta `prisma migrate deploy` al arrancar, así que las migraciones se aplican solas en cada despliegue.

## 3. Pasos para un primer despliegue

1. Crear la base de datos y copiar su `DATABASE_URL`.
2. Construir y subir la imagen del backend; configurar las variables de arriba.
3. Comprobar `GET /api/health` y `/api/docs`.
4. Publicar el frontend (sin `VITE_DEMO`) con `/api` apuntando a la API.
5. Opcional: `npm run seed` una vez contra esa base para tener datos de demostración.

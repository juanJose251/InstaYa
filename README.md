# InstaYa! — Inventory Management SaaS

[![CI](https://github.com/juanJose251/InstaYa/actions/workflows/ci.yml/badge.svg)](https://github.com/juanJose251/InstaYa/actions/workflows/ci.yml)

Multi-tenant inventory management system for small businesses in El Salvador. Team project at ITCA-FEPADE, where I am the tech lead.

**Demo:** deploy the `frontend/` folder to Netlify (the included `netlify.toml` already sets `VITE_DEMO=true`). Log in with `demo@instaya.app` / `demo1234`. The demo runs fully in the browser with sample data; there is no live backend (see [Architecture](#architecture)).

<!-- TODO: add screenshots or a GIF of the products, sales and reports screens -->

## Features

- Company + user registration and login with JWT; roles `ADMIN` and `EMPLEADO`
- **Multi-tenant:** every query is scoped to the authenticated user's company, so one business can never read another's data
- Products CRUD with soft delete, low-stock filter and search
- Stock movements (`ENTRADA`, `SALIDA`, `AJUSTE`) that update stock inside a database transaction
- Sales with line items: the server computes the total from product prices, checks stock and decrements it atomically; cancelling a sale restores the stock
- Reports summary (sales total, inventory value, low-stock count) for today / week / month
- Mobile-first React front end

## Architecture

```
React (Vite) ── /api ──▶ Express ──▶ Prisma ──▶ PostgreSQL
                          │
        authenticate (JWT) → requireRole → Zod validation → handler (asyncHandler)
                          │
                    errorHandler (one place that maps errors to HTTP responses)
```

- **Monorepo:** `backend/` (REST API) and `frontend/` (web app).
- **Auth:** JWT carrying `empresaId` and role. `authenticate` re-checks in the database that the user and the company are still active.
- **Multi-tenancy:** shared database, shared schema, a `empresaId` column on every business table. Handlers always filter by `req.user.empresaId`; `tenantGuard` rejects a body that tries to target another company.
- **Validation:** Zod schemas on every write endpoint.
- **Errors:** handlers are wrapped in `asyncHandler`; the central `errorHandler` maps `AppError`, `ZodError` and Prisma unique violations to the right status code, and hides unexpected errors behind a generic 500.
- **Demo mode:** a free tier can't host a stable Express + Postgres backend, so the public demo uses `frontend/src/lib/demoApi.ts`, which implements the same endpoints and rules on top of `localStorage`. The real backend runs locally with Docker (below). See [`docs/FLUJO.md`](docs/FLUJO.md).

## Tech stack

- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT, bcrypt, Zod, Helmet
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS v4, React Router
- **Tests:** Vitest + Supertest (backend, no database needed: Prisma is mocked), Vitest (front end)
- **CI:** GitHub Actions
- **Mobile app:** React Native *(planned)*

## Project structure

```
instaya/
├── backend/
│   ├── prisma/          schema and migrations
│   └── src/
│       ├── app.ts       Express app (no listen, so it can be tested)
│       ├── server.ts    starts the server
│       ├── middleware/  auth, tenant, error
│       ├── routes/      auth, usuarios, productos, movimientos, ventas, reportes
│       ├── lib/         prisma client, asyncHandler
│       └── test/        Supertest suites
├── frontend/
│   └── src/lib/         api client + demoApi (in-browser API for the demo)
├── docs/                FLUJO.md (how it works) and PREGUNTAS.md (interview Q&A)
├── docker-compose.yml   local PostgreSQL
└── netlify.toml         demo deploy
```

## Run it locally

Requirements: Node.js 20+ and Docker (or your own PostgreSQL 14+).

```bash
docker compose up -d        # PostgreSQL on :5432

# backend
cd backend
cp .env.example .env        # set JWT_SECRET
npm install
npx prisma migrate dev
npm run dev                 # http://localhost:4000

# frontend (another terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

Front end in demo mode (no backend): `VITE_DEMO=true npm run dev`.

## Tests

```bash
cd backend && npm test      # 31 tests: auth, roles, tenant isolation, sales, stock movements
cd frontend && npm test     # 15 tests: demo API rules
```

## API overview

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public |
| GET | `/api/usuarios/me` | current user |
| GET / POST | `/api/usuarios` | list / create employees (POST: admin only) |
| GET / POST / PUT / DELETE | `/api/productos` | writes: admin only; DELETE is a soft delete |
| GET / POST | `/api/movimientos` | stock movements |
| GET / POST | `/api/ventas`, POST `/api/ventas/:id/anular` | sales (with items or quick total) |
| GET | `/api/reportes/resumen?rango=hoy\|semana\|mes` | summary |

## Status and roadmap

Done: data model, JWT auth, multi-tenant isolation, inventory, stock movements, sales (with cancellation), reports summary, front end screens, tests, CI.
Not done yet: categories and suppliers endpoints, sale line-item entry in the front end (it registers quick sales with a manual total), Excel import, PWA, payments, mobile app, production deployment of the backend.

## Decisions and problems

<!-- Draft written by Claude Code. Rewrite in your own words after studying docs/FLUJO.md. -->

- **`app.ts` / `server.ts` split:** lets Supertest import the app without opening a port.
- **Mocked Prisma in tests:** fast and runnable in CI without a database; the trade-off is that SQL behaviour (unique constraints, transactions) is not exercised.
- **Server-side totals:** the sale total is calculated from product prices in the database, so a client can't send a made-up price.

# InstaYa! — Inventory Management SaaS

[![CI](https://github.com/juanJose251/InstaYa/actions/workflows/ci.yml/badge.svg)](https://github.com/juanJose251/InstaYa/actions/workflows/ci.yml)

Multi-tenant inventory management system for small businesses in El Salvador. Team project at ITCA-FEPADE, where I am the tech lead.

**Demo:** deploy the `frontend/` folder to Netlify (the included `netlify.toml` already sets `VITE_DEMO=true`). Log in with `demo@instaya.app` / `demo1234`. The demo runs fully in the browser with sample data; there is no live backend (see [Architecture](#architecture)). The full stack runs locally with one command (see [Run it](#run-it-locally)).

<p>
  <img src="docs/screenshots/dashboard.png" width="24%" alt="Dashboard with KPIs and the restock assistant" />
  <img src="docs/screenshots/ventas.png" width="24%" alt="Sale with line items" />
  <img src="docs/screenshots/reportes.png" width="24%" alt="Reports with top-selling products" />
  <img src="docs/screenshots/catalogo.png" width="24%" alt="Categories and suppliers" />
</p>

## Features

- Company + user registration and login with JWT; roles `ADMIN` and `EMPLEADO`; rate-limited auth routes
- **Multi-tenant:** every query is scoped to the authenticated user's company, so one business can never read another's data (including the categories and suppliers a product points to)
- Products CRUD with soft delete, low-stock filter and search; **categories and suppliers**
- Stock movements (`ENTRADA`, `SALIDA`, `AJUSTE`) that update stock inside a database transaction
- Sales with line items: the server computes the total from product prices, checks stock and decrements it **atomically**; cancelling a sale restores the stock
- Reports: summary (sales total, inventory value, low-stock count) and **top-selling products** (SQL `JOIN` + `GROUP BY`)
- **Restock assistant:** from the last 30 days of sales it estimates how many days each product's stock will last and how many units to order. The numbers come from a deterministic rule; an LLM (Anthropic API) only writes the summary, and the endpoint falls back to a rule-based summary when there is no API key or the call fails
- Interactive API docs (Swagger UI at `/api/docs`, OpenAPI spec at `/api/docs/openapi.json`)
- Mobile-first React front end

## Architecture

```
React (Vite) ── /api ──▶ Express ──▶ Prisma ──▶ PostgreSQL
                          │
        rateLimit → authenticate (JWT) → requireRole → Zod validation → handler (asyncHandler)
                          │
                    errorHandler (one place that maps errors to HTTP responses)
```

- **Monorepo:** `backend/` (REST API) and `frontend/` (web app).
- **Auth:** JWT carrying `empresaId` and role. `authenticate` re-checks in the database that the user and the company are still active.
- **Multi-tenancy:** shared database, shared schema, a `empresaId` column on every business table. Handlers always filter by `req.user.empresaId`; `tenantGuard` rejects a body that tries to target another company.
- **Validation:** Zod schemas on every write endpoint.
- **Errors:** handlers are wrapped in `asyncHandler`; the central `errorHandler` maps `AppError`, `ZodError` and Prisma unique violations to the right status code, and hides unexpected errors behind a generic 500.
- **Demo mode:** a free tier can't host a stable Express + Postgres backend, so the public demo uses `frontend/src/lib/demoApi.ts`, which implements the same endpoints and rules on top of `localStorage`. See [`docs/FLUJO.md`](docs/FLUJO.md).

## Tech stack

- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT, bcrypt, Zod, Helmet, express-rate-limit, OpenAPI / Swagger UI
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS v4, React Router
- **AI:** Anthropic API (optional, for the restock summary)
- **Testing:** Vitest + Supertest (unit, Prisma mocked), integration tests against a real PostgreSQL, Playwright (E2E)
- **DevOps:** Docker (multi-stage images, nginx for the SPA), docker-compose, GitHub Actions CI
- **Mobile app:** React Native *(planned)*

## Project structure

```
instaya/
├── backend/
│   ├── Dockerfile
│   ├── prisma/          schema, migrations and seed.ts (demo data)
│   └── src/
│       ├── app.ts       Express app (no listen, so it can be tested)
│       ├── server.ts    starts the server
│       ├── middleware/  auth, tenant, error, rateLimit
│       ├── routes/      auth, usuarios, productos, categorias, proveedores, movimientos, ventas, reportes, asistente
│       ├── lib/         prisma client, asyncHandler, reposicion (restock rules + LLM summary)
│       ├── docs/        OpenAPI spec + Swagger UI
│       ├── test/        unit suites (Prisma mocked)
│       └── integration/ suites against a real PostgreSQL
├── frontend/
│   ├── Dockerfile, nginx.conf
│   ├── e2e/             Playwright specs
│   └── src/lib/         api client + demoApi (in-browser API for the demo)
├── docs/                FLUJO.md (how it works), PREGUNTAS.md (interview Q&A), DESPLIEGUE.md, screenshots/
├── docker-compose.yml   PostgreSQL (+ API and web with `--profile full`)
└── netlify.toml         demo deploy
```

## Run it locally

Requirements: Node.js 20+ and Docker (or your own PostgreSQL 14+).

**Everything in containers** (PostgreSQL + API + web on http://localhost:8080):

```bash
docker compose --profile full up --build
```

The API container applies the migrations on start. For demo data, run the seed from your machine against the published database port:

```bash
cd backend && npm install
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/instaya?schema=public" npm run seed   # demo@instaya.app / demo1234
```

**Development mode:**

```bash
docker compose up -d db     # PostgreSQL on :5432

# backend
cd backend
cp .env.example .env        # set JWT_SECRET (optionally ANTHROPIC_API_KEY)
npm install
npx prisma migrate dev
npm run seed                # optional: demo company with 30 days of sales
npm run dev                 # http://localhost:4000, docs at /api/docs

# frontend (another terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

Front end in demo mode (no backend): `VITE_DEMO=true npm run dev`.

## Tests

```bash
cd backend  && npm test                  # 56 unit tests: auth, roles, tenant isolation, sales, catalog, restock rules
cd backend  && npm run test:integration  # 6 tests against a real PostgreSQL (needs DATABASE_URL + migrations applied)
cd frontend && npm test                  # 25 tests: demo API rules
cd frontend && npm run test:e2e          # 6 Playwright flows on the demo (PW_CHANNEL=chrome uses your installed Chrome)
```

CI runs all of them on every push, plus the Docker image builds and a seed run.

## API overview

Full, interactive reference at `/api/docs`.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public, rate limited |
| GET | `/api/usuarios/me` | current user |
| GET / POST | `/api/usuarios` | list / create employees (POST: admin only) |
| GET / POST / PUT / DELETE | `/api/productos` | writes: admin only; DELETE is a soft delete |
| GET / POST / PUT / DELETE | `/api/categorias`, `/api/proveedores` | writes: admin only |
| GET / POST | `/api/movimientos` | stock movements |
| GET / POST | `/api/ventas`, POST `/api/ventas/:id/anular` | sales (with items or quick total) |
| GET | `/api/reportes/resumen?rango=hoy\|semana\|mes` | summary |
| GET | `/api/reportes/top-productos?rango=` | top 5 products by units sold |
| GET | `/api/asistente/reposicion` | restock suggestions + summary |

## Status and roadmap

Done: data model, JWT auth, multi-tenant isolation, inventory, categories and suppliers, stock movements, sales with line items and cancellation, reports, restock assistant, OpenAPI docs, front end screens, unit / integration / E2E tests, Docker, CI.
Not done yet: Excel import, PWA, payments, mobile app, production deployment of the backend (the plan is in [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md)), editing and deleting products from the front end.

## Decisions and problems

<!-- Draft written by Claude Code. Rewrite in your own words after studying docs/FLUJO.md. -->

- **`app.ts` / `server.ts` split:** lets Supertest import the app without opening a port.
- **Mocked Prisma in unit tests, real PostgreSQL in integration tests:** the mocks are fast and need no database, but they can't exercise SQL behaviour (unique constraints, transactions, raw queries). The integration suite covers exactly that and runs in CI against a `postgres` service.
- **Server-side totals:** the sale total is calculated from product prices in the database, so a client can't send a made-up price.
- **Atomic stock decrement:** the first version read the stock, checked it, and then decremented it. Two simultaneous sales of the last unit could both pass the check and leave negative stock. The decrement is now a single `updateMany` with `stockActual >= cantidad` in its `WHERE`, so the database serialises the two writes and the loser gets a 400. An integration test fires 30 concurrent one-unit sales against a stock of 5 and asserts that exactly 5 succeed (without the guard, 11 of them went through). Stock movements use the same pattern (`increment` for entries, guarded `decrement` for exits).
- **Tenant check on relations:** a product's `categoriaId` / `proveedorId` are looked up with the user's `empresaId` before saving. Without that, a user could attach another company's category by guessing its id.
- **Raw SQL where it pays off:** top products and the restock query aggregate with `JOIN` / `GROUP BY` in PostgreSQL through `$queryRaw` tagged templates (values are bound as parameters, not concatenated) instead of loading every sale into memory.
- **LLM as an extra, not a dependency:** the reorder quantities are a deterministic rule that is unit tested; the model only phrases the summary. If the key is missing or the API call fails, the endpoint still answers.

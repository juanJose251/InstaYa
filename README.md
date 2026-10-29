# InstaYa! — Inventory Management SaaS

[![CI](https://github.com/juanJose251/InstaYa/actions/workflows/ci.yml/badge.svg)](https://github.com/juanJose251/InstaYa/actions/workflows/ci.yml)

Multi-tenant inventory management system for small businesses in El Salvador. Team project at ITCA-FEPADE, where I am the tech lead.

**Live demo: https://instaya-demo.netlify.app** (built from `frontend/` with `VITE_DEMO=true`, see `netlify.toml`). Log in with `demo@instaya.app` / `demo1234`. The demo runs fully in the browser with sample data; there is no live backend (see [Architecture](#architecture)). The full stack runs locally with one command (see [Run it](#run-it-locally)).

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
- **SaaS plan** (from the business plan): 15-day free trial, $50 one-time setup, $10/month. When the trial or the paid month ends the account becomes **read-only**: writes return `402`, but the business can still see and export everything; data is never deleted. A banner warns 5 days before
- **Platform panel** for the operator (`/api/plataforma`, protected by an `x-platform-key` header, not by the customer JWT): list companies and activate the paid plan for N months after a manual payment (bank transfer, Wompi, N1co)
- **Excel / CSV import** of the initial inventory (the $50 setup service): reads `.xlsx` and `.csv` in the browser with a small reader written from scratch (no library), recognises Spanish headers, shows a preview with errors per row and a downloadable template; the API applies it all-or-nothing, creates missing categories and suppliers, updates existing products by SKU or name and records the stock movements
- **Export to Excel:** inventory and sales for the selected period
- **Team management:** create employees, change role, deactivate (an admin can't deactivate themself), reset passwords; company settings
- **PWA:** installable from the browser (manifest, icons, service worker)
- Interactive API docs (Swagger UI at `/api/docs`, OpenAPI spec at `/api/docs/openapi.json`)
- Mobile-first React front end with a public landing page (problem, features, pricing, FAQ)

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
- **Mobile:** installable PWA; React Native *(planned)*

## Project structure

```
instaya/
├── backend/
│   ├── Dockerfile
│   ├── prisma/          schema, migrations and seed.ts (demo data)
│   └── src/
│       ├── app.ts       Express app (no listen, so it can be tested)
│       ├── server.ts    starts the server
│       ├── middleware/  auth (JWT + read-only plan check), tenant, error, rateLimit
│       ├── routes/      auth, usuarios, empresa, productos (+ import), categorias, proveedores, movimientos, ventas, reportes, asistente, suscripcion, plataforma
│       ├── lib/         prisma client, asyncHandler, reposicion (restock rules + LLM summary), suscripcion (plan rules)
│       ├── docs/        OpenAPI spec + Swagger UI
│       ├── test/        unit suites (Prisma mocked)
│       └── integration/ suites against a real PostgreSQL
├── frontend/
│   ├── Dockerfile, nginx.conf
│   ├── e2e/             Playwright specs
│   └── src/lib/         api client, demoApi (in-browser API for the demo), xlsx + hoja (spreadsheet read/write), pwa
├── docs/                FLUJO.md (how it works), PREGUNTAS.md (interview Q&A), DESPLIEGUE.md, screenshots/
├── local/               Windows installer: launcher, Inno Setup script, packaging script
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

**Windows installer (offline, no Docker):** `local/` builds `InstaYa-Setup-<version>.exe`, which bundles a portable Node.js, an embedded PostgreSQL 16, the API and the web app on one port. See [`local/LEEME.md`](local/LEEME.md).

## Tests

```bash
cd backend  && npm test                  # 84 unit tests: auth, roles, tenant isolation, sales, catalog, restock, plan, import, team
cd backend  && npm run test:integration  # 8 tests against a real PostgreSQL (needs DATABASE_URL + migrations applied)
cd frontend && npm test                  # 44 tests: demo API rules and spreadsheet parsing
cd frontend && npm run test:e2e          # 12 Playwright flows on the demo (PW_CHANNEL=chrome uses your installed Chrome)
```

CI runs all of them on every push, plus the Docker image builds and a seed run.

## API overview

Full, interactive reference at `/api/docs`.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public, rate limited |
| GET | `/api/usuarios/me` | current user, company and plan |
| GET / POST / PUT | `/api/usuarios`, `/api/usuarios/:id` | list / create / update employees (writes: admin only) |
| GET / PUT | `/api/empresa` | company settings (PUT: admin only) |
| GET / POST / PUT / DELETE | `/api/productos` | writes: admin only; DELETE is a soft delete |
| POST | `/api/productos/importar` | bulk import, all or nothing (admin only) |
| GET / POST / PUT / DELETE | `/api/categorias`, `/api/proveedores` | writes: admin only |
| GET / POST | `/api/movimientos` | stock movements |
| GET / POST | `/api/ventas`, POST `/api/ventas/:id/anular` | sales (with items or quick total) |
| GET | `/api/reportes/resumen?rango=hoy\|semana\|mes` | summary |
| GET | `/api/reportes/top-productos?rango=` | top 5 products by units sold |
| GET | `/api/asistente/reposicion` | restock suggestions + summary |
| GET | `/api/suscripcion` | plan status, prices and how to pay |
| GET / POST | `/api/plataforma/empresas`, `/api/plataforma/empresas/:id/activar` | operator only (`x-platform-key`) |

Any write while the plan is expired returns `402 Payment Required`.

## Status and roadmap

Done: data model, JWT auth, multi-tenant isolation, inventory, categories and suppliers, stock movements, sales with line items and cancellation, reports, restock assistant, SaaS plan with trial and read-only mode, platform panel, Excel/CSV import and export, team management, landing page, PWA, OpenAPI docs, unit / integration / E2E tests, Docker, CI.
Not done yet: production deployment of the backend (the plan is in [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md)), automatic payments (Stripe doesn't operate in El Salvador; payments are confirmed by hand from the platform panel), electronic invoicing (DTE), React Native app.

## Decisions and problems

<!-- Draft written by Claude Code. Rewrite in your own words after studying docs/FLUJO.md. -->

- **`app.ts` / `server.ts` split:** lets Supertest import the app without opening a port.
- **Mocked Prisma in unit tests, real PostgreSQL in integration tests:** the mocks are fast and need no database, but they can't exercise SQL behaviour (unique constraints, transactions, raw queries). The integration suite covers exactly that and runs in CI against a `postgres` service.
- **Server-side totals:** the sale total is calculated from product prices in the database, so a client can't send a made-up price.
- **Atomic stock decrement:** the first version read the stock, checked it, and then decremented it. Two simultaneous sales of the last unit could both pass the check and leave negative stock. The decrement is now a single `updateMany` with `stockActual >= cantidad` in its `WHERE`, so the database serialises the two writes and the loser gets a 400. An integration test fires 30 concurrent one-unit sales against a stock of 5 and asserts that exactly 5 succeed (without the guard, 11 of them went through). Stock movements use the same pattern (`increment` for entries, guarded `decrement` for exits).
- **Tenant check on relations:** a product's `categoriaId` / `proveedorId` are looked up with the user's `empresaId` before saving. Without that, a user could attach another company's category by guessing its id.
- **Raw SQL where it pays off:** top products and the restock query aggregate with `JOIN` / `GROUP BY` in PostgreSQL through `$queryRaw` tagged templates (values are bound as parameters, not concatenated) instead of loading every sale into memory.
- **Read-only instead of lockout:** an expired plan blocks writes with `402` in the same `authenticate` middleware that already loads the company, but reads and exports keep working. A small business never loses access to its own data for a late payment.
- **Spreadsheet reader without a library:** `.xlsx` is a zip of XML files; the browser's `DecompressionStream` inflates it, so the import adds no dependency to the bundle. It was checked against files written by openpyxl.
- **LLM as an extra, not a dependency:** the reorder quantities are a deterministic rule that is unit tested; the model only phrases the summary. If the key is missing or the API call fails, the endpoint still answers.

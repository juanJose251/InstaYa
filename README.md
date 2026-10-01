# InstaYa! — Inventory Management SaaS

Multi-tenant inventory management system for small businesses in El Salvador. Team project at ITCA-FEPADE, where I am the tech lead.

> **Status:** work in progress. The backend foundation (data model, JWT auth, multi-tenant isolation) and the React front end (all main screens) are done. The inventory, stock movements and sales API endpoints are the next step, so the front end screens that depend on them are not connected to real data yet.

## Stack

- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT, bcrypt, Zod, Helmet
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS v4, React Router
- **Mobile app:** React Native *(planned)*

## What works today

- Company + user registration and login with JWT (`/api/auth/register`, `/api/auth/login`)
- Multi-tenant model: every query is scoped to the user's company (`tenantGuard` middleware)
- Request validation with Zod and security headers with Helmet
- Prisma schema with companies, users, categories, products, suppliers, stock movements, sales and sale items
- Front end: login, register, dashboard, products, stock movements, sales, reports and settings pages, with a protected layout and a typed API client

## Project structure

```
instaya/
├── backend/    # REST API (Express + Prisma)
├── frontend/   # Web app (React + Vite)
└── scripts/    # start.ps1: starts backend and front end on Windows
```

## Roadmap

1. Foundations: data model, JWT auth, multi-tenant (done)
2. Inventory CRUD: products, categories, suppliers, stock in/out
3. Sales, reports and low-stock alerts
4. React front end, mobile-first (screens done, waiting for phases 2-3)
5. Excel import, PWA, payments
6. Deployment, QA and pilot

## Run it locally

Requirements: Node.js 20+ and PostgreSQL 14+.

```bash
# backend
cd backend
cp .env.example .env        # set DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev
npm run dev                 # http://localhost:4000

# frontend (another terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

# InstaYa! — Sistema de Gestión de Inventarios SaaS

Sistema de gestión de inventarios para PYMES salvadoreñas. Proyecto de ITCA-FEPADE.

## Stack
- **Backend:** Node.js + Express + TypeScript + PostgreSQL (Prisma)
- **Frontend:** React + Vite + Tailwind CSS *(Fase 4)*
- **App móvil:** React Native *(Fase 5)*

## Estructura
```
instaya/
├── backend/   # API REST (Express + Prisma)
└── frontend/  # Interfaz web (React)
```

## Fases de desarrollo
1. **Fundaciones** — monorepo, modelo de datos, auth JWT, multi-tenant
2. **CRUD inventario** — productos, categorías, proveedores, entradas/salidas
3. **Ventas, reportes y alertas** — módulo de ventas, reportes, stock mínimo
4. **Frontend React** — interfaz mobile-first
5. **Carga inicial + PWA + pagos** — importación Excel, PWA, React Native, pasarela
6. **Despliegue + piloto** — cloud, QA, trial 15 días

## Requisitos
- Node.js ≥ 20
- PostgreSQL ≥ 14
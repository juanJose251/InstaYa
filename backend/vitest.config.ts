import { defineConfig } from "vitest/config";

// `npm test` = tests unitarios con Prisma simulado (sin base de datos).
// Los de src/integration necesitan PostgreSQL real: `npm run test:integration`.
export default defineConfig({
  test: { exclude: ["node_modules", "dist", "src/integration/**"] },
});

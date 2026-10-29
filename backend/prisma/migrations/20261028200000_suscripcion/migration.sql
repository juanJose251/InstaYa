-- Plan comercial por empresa (prueba de 15 días -> plan Básico de pago mensual)
CREATE TYPE "PlanTipo" AS ENUM ('PRUEBA', 'BASICO');

ALTER TABLE "empresas" ADD COLUMN "plan" "PlanTipo" NOT NULL DEFAULT 'PRUEBA',
ADD COLUMN "suscripcionFin" TIMESTAMP(3);

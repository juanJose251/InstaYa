import { Router, Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { env } from "../config/env";
import { AppError } from "../middleware/error";
import { calcularSuscripcion, extenderSuscripcion } from "../lib/suscripcion";

/**
 * Panel del operador del SaaS (no de los clientes).
 * Se protege con una clave propia en `x-platform-key`, distinta del JWT de los negocios:
 * un ADMIN de una empresa nunca puede activarse el plan a sí mismo.
 */
const router = Router();

function iguales(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function requirePlatformKey(req: Request, _res: Response, next: NextFunction) {
  if (!env.platformKey) return next(new AppError(503, "Panel de plataforma desactivado (falta PLATFORM_KEY)"));
  const clave = req.header("x-platform-key") ?? "";
  if (!iguales(clave, env.platformKey)) return next(new AppError(401, "Clave de plataforma inválida"));
  next();
}

router.use(requirePlatformKey);

// GET /api/plataforma/empresas — todas las empresas con su estado de plan
router.get(
  "/empresas",
  asyncHandler(async (_req, res) => {
    const empresas = await prisma.empresa.findMany({
      select: { id: true, nombre: true, giro: true, activa: true, plan: true, trialFin: true, suscripcionFin: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ empresas: empresas.map((e) => ({ ...e, suscripcion: calcularSuscripcion(e) })) });
  })
);

const activarSchema = z.object({
  meses: z.number().int().min(1, "Mínimo 1 mes").max(24, "Máximo 24 meses").default(1),
});

// POST /api/plataforma/empresas/:id/activar — registrar un pago: plan BASICO por N meses
router.post(
  "/empresas/:id/activar",
  asyncHandler(async (req, res) => {
    const { meses } = activarSchema.parse(req.body ?? {});
    const empresa = await prisma.empresa.findFirst({ where: { id: req.params.id } });
    if (!empresa) throw new AppError(404, "Empresa no encontrada");
    const vigente = empresa.plan === "BASICO" ? empresa.suscripcionFin : null;
    const actualizada = await prisma.empresa.update({
      where: { id: empresa.id },
      data: { plan: "BASICO", suscripcionFin: extenderSuscripcion(vigente, meses) },
      select: { id: true, nombre: true, plan: true, trialFin: true, suscripcionFin: true },
    });
    res.json({ empresa: { ...actualizada, suscripcion: calcularSuscripcion(actualizada) } });
  })
);

export default router;

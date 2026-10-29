import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();
router.use(authenticate);

const select = { id: true, nombre: true, giro: true, direccion: true, telefono: true, trialFin: true, plan: true, suscripcionFin: true };

const empresaSchema = z
  .object({
    nombre: z.string().trim().min(2, "Nombre de empresa requerido").optional(),
    giro: z.string().trim().optional(),
    direccion: z.string().trim().optional(),
    telefono: z.string().trim().optional(),
  })
  .strict();

// GET /api/empresa — datos de MI empresa
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const empresa = await prisma.empresa.findFirst({ where: { id: req.user!.empresaId }, select });
    res.json({ empresa });
  })
);

// PUT /api/empresa — editar datos del negocio (solo ADMIN). El plan no se puede tocar desde aquí.
router.put(
  "/",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = empresaSchema.parse(req.body);
    const empresa = await prisma.empresa.update({ where: { id: req.user!.empresaId }, data, select });
    res.json({ empresa });
  })
);

export default router;

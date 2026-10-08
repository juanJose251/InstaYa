import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import prisma from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error";

const router = Router();
router.use(authenticate);

const categoriaSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido"),
  descripcion: z.string().optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const categorias = await prisma.categoria.findMany({
      where: { empresaId: req.user!.empresaId },
      include: { _count: { select: { productos: true } } },
      orderBy: { nombre: "asc" },
    });
    res.json({ categorias });
  })
);

router.post(
  "/",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = categoriaSchema.parse(req.body);
    const categoria = await prisma.categoria.create({ data: { ...data, empresaId: req.user!.empresaId } });
    res.status(201).json({ categoria });
  })
);

router.put(
  "/:id",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = categoriaSchema.partial().parse(req.body);
    const { empresaId } = req.user!;
    const existe = await prisma.categoria.findFirst({ where: { id: req.params.id, empresaId } });
    if (!existe) throw new AppError(404, "Categoría no encontrada");
    const categoria = await prisma.categoria.update({ where: { id: existe.id }, data });
    res.json({ categoria });
  })
);

// Borrado real: los productos quedan sin categoría (onDelete: SetNull en el esquema)
router.delete(
  "/:id",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { empresaId } = req.user!;
    const existe = await prisma.categoria.findFirst({ where: { id: req.params.id, empresaId } });
    if (!existe) throw new AppError(404, "Categoría no encontrada");
    await prisma.categoria.delete({ where: { id: existe.id } });
    res.status(204).end();
  })
);

export default router;

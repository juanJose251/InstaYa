import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import prisma from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error";

const router = Router();
router.use(authenticate);

const proveedorSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido"),
  telefono: z.string().optional(),
  email: z.string().email("Correo inválido").optional(),
  direccion: z.string().optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const proveedores = await prisma.proveedor.findMany({
      where: { empresaId: req.user!.empresaId, activo: true },
      include: { _count: { select: { productos: true } } },
      orderBy: { nombre: "asc" },
    });
    res.json({ proveedores });
  })
);

router.post(
  "/",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = proveedorSchema.parse(req.body);
    const proveedor = await prisma.proveedor.create({ data: { ...data, empresaId: req.user!.empresaId } });
    res.status(201).json({ proveedor });
  })
);

router.put(
  "/:id",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = proveedorSchema.partial().parse(req.body);
    const { empresaId } = req.user!;
    const existe = await prisma.proveedor.findFirst({ where: { id: req.params.id, empresaId } });
    if (!existe) throw new AppError(404, "Proveedor no encontrado");
    const proveedor = await prisma.proveedor.update({ where: { id: existe.id }, data });
    res.json({ proveedor });
  })
);

// Baja lógica, igual que productos
router.delete(
  "/:id",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { empresaId } = req.user!;
    const existe = await prisma.proveedor.findFirst({ where: { id: req.params.id, empresaId } });
    if (!existe) throw new AppError(404, "Proveedor no encontrado");
    await prisma.proveedor.update({ where: { id: existe.id }, data: { activo: false } });
    res.status(204).end();
  })
);

export default router;

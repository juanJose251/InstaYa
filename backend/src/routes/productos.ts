import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error";
import { Role } from "@prisma/client";

const router = Router();
router.use(authenticate);

const productoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  sku: z.string().optional(),
  descripcion: z.string().optional(),
  categoriaId: z.string().optional(),
  proveedorId: z.string().optional(),
  precioCompra: z.number().nonnegative("Precio de compra inválido"),
  precioVenta: z.number().nonnegative("Precio de venta inválido"),
  stockMinimo: z.number().int().nonnegative().default(0),
});

// La categoría y el proveedor deben ser de la misma empresa: si no, un id ajeno filtraría datos entre tenants.
async function verificarRelaciones(empresaId: string, data: { categoriaId?: string; proveedorId?: string }) {
  if (data.categoriaId && !(await prisma.categoria.findFirst({ where: { id: data.categoriaId, empresaId } }))) {
    throw new AppError(400, "Categoría no válida");
  }
  if (data.proveedorId && !(await prisma.proveedor.findFirst({ where: { id: data.proveedorId, empresaId } }))) {
    throw new AppError(400, "Proveedor no válido");
  }
}

// GET /api/productos?q=&bajoStock=true
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { empresaId } = req.user!;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    let productos = await prisma.producto.findMany({
      where: {
        empresaId,
        activo: true,
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { categoria: { select: { nombre: true } }, proveedor: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    });
    if (req.query.bajoStock === "true") {
      productos = productos.filter((p) => p.stockActual <= p.stockMinimo);
    }
    res.json({ productos });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const producto = await prisma.producto.findFirst({
      where: { id: req.params.id, empresaId: req.user!.empresaId },
    });
    if (!producto) throw new AppError(404, "Producto no encontrado");
    res.json({ producto });
  })
);

router.post(
  "/",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = productoSchema.parse(req.body);
    await verificarRelaciones(req.user!.empresaId, data);
    const producto = await prisma.producto.create({
      data: { ...data, empresaId: req.user!.empresaId },
    });
    res.status(201).json({ producto });
  })
);

router.put(
  "/:id",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = productoSchema.partial().parse(req.body);
    const { empresaId } = req.user!;
    const existe = await prisma.producto.findFirst({ where: { id: req.params.id, empresaId } });
    if (!existe) throw new AppError(404, "Producto no encontrado");
    await verificarRelaciones(empresaId, data);
    const producto = await prisma.producto.update({ where: { id: existe.id }, data });
    res.json({ producto });
  })
);

// Baja lógica: conserva el historial de ventas y movimientos
router.delete(
  "/:id",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { empresaId } = req.user!;
    const existe = await prisma.producto.findFirst({ where: { id: req.params.id, empresaId } });
    if (!existe) throw new AppError(404, "Producto no encontrado");
    await prisma.producto.update({ where: { id: existe.id }, data: { activo: false } });
    res.status(204).end();
  })
);

export default router;

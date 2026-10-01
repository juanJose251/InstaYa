import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
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

function handleError(err: unknown, next: NextFunction) {
  if (err instanceof z.ZodError) return next(new AppError(400, err.errors[0].message));
  if ((err as { code?: string })?.code === "P2002") {
    return next(new AppError(409, "Ya existe un producto con ese SKU"));
  }
  next(err);
}

// GET /api/productos?q=&bajoStock=true
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
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
      orderBy: { nombre: "asc" },
    });
    if (req.query.bajoStock === "true") {
      productos = productos.filter((p) => p.stockActual <= p.stockMinimo);
    }
    res.json({ productos });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const producto = await prisma.producto.findFirst({
      where: { id: req.params.id, empresaId: req.user!.empresaId },
    });
    if (!producto) throw new AppError(404, "Producto no encontrado");
    res.json({ producto });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = productoSchema.parse(req.body);
    const producto = await prisma.producto.create({
      data: { ...data, empresaId: req.user!.empresaId },
    });
    res.status(201).json({ producto });
  } catch (err) {
    handleError(err, next);
  }
});

router.put("/:id", requireRole(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = productoSchema.partial().parse(req.body);
    const { empresaId } = req.user!;
    const existe = await prisma.producto.findFirst({ where: { id: req.params.id, empresaId } });
    if (!existe) throw new AppError(404, "Producto no encontrado");
    const producto = await prisma.producto.update({ where: { id: existe.id }, data });
    res.json({ producto });
  } catch (err) {
    handleError(err, next);
  }
});

// Baja lógica: conserva el historial de ventas y movimientos
router.delete("/:id", requireRole(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { empresaId } = req.user!;
    const existe = await prisma.producto.findFirst({ where: { id: req.params.id, empresaId } });
    if (!existe) throw new AppError(404, "Producto no encontrado");
    await prisma.producto.update({ where: { id: existe.id }, data: { activo: false } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error";

const router = Router();
router.use(authenticate);

const movimientoSchema = z.object({
  productoId: z.string().min(1, "Producto requerido"),
  tipo: z.enum(["ENTRADA", "SALIDA", "AJUSTE"]),
  // ENTRADA/SALIDA: cantidad > 0. AJUSTE: nuevo stock absoluto (>= 0).
  cantidad: z.number().int("La cantidad debe ser entera").nonnegative("Cantidad inválida"),
  motivo: z.string().optional(),
});

// GET /api/movimientos?productoId=
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productoId = typeof req.query.productoId === "string" ? req.query.productoId : undefined;
    const movimientos = await prisma.movimientoStock.findMany({
      where: { empresaId: req.user!.empresaId, ...(productoId ? { productoId } : {}) },
      include: { producto: { select: { nombre: true } }, creadoPor: { select: { nombre: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ movimientos });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = movimientoSchema.parse(req.body);
    if (data.tipo !== "AJUSTE" && data.cantidad < 1) {
      throw new AppError(400, "La cantidad debe ser mayor a 0");
    }
    const { empresaId, id: userId } = req.user!;

    const movimiento = await prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findFirst({
        where: { id: data.productoId, empresaId, activo: true },
      });
      if (!producto) throw new AppError(404, "Producto no encontrado");

      let nuevoStock: number;
      if (data.tipo === "ENTRADA") nuevoStock = producto.stockActual + data.cantidad;
      else if (data.tipo === "SALIDA") nuevoStock = producto.stockActual - data.cantidad;
      else nuevoStock = data.cantidad;

      if (nuevoStock < 0) throw new AppError(400, "Stock insuficiente para esta salida");

      await tx.producto.update({ where: { id: producto.id }, data: { stockActual: nuevoStock } });
      return tx.movimientoStock.create({
        data: {
          empresaId,
          productoId: producto.id,
          tipo: data.tipo,
          cantidad: data.cantidad,
          motivo: data.motivo,
          creadoPorId: userId,
        },
      });
    });

    res.status(201).json({ movimiento });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(400, err.errors[0].message));
    next(err);
  }
});

export default router;

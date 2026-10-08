import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
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
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const productoId = typeof req.query.productoId === "string" ? req.query.productoId : undefined;
    const movimientos = await prisma.movimientoStock.findMany({
      where: { empresaId: req.user!.empresaId, ...(productoId ? { productoId } : {}) },
      include: { producto: { select: { nombre: true } }, creadoPor: { select: { nombre: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ movimientos });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
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

      // ENTRADA/SALIDA se aplican como incremento/decremento en la propia sentencia SQL (no "leer, sumar, escribir"),
      // para que dos movimientos simultáneos no se pisen. La SALIDA además exige stock suficiente en el WHERE.
      if (data.tipo === "ENTRADA") {
        await tx.producto.update({ where: { id: producto.id }, data: { stockActual: { increment: data.cantidad } } });
      } else if (data.tipo === "SALIDA") {
        const { count } = await tx.producto.updateMany({
          where: { id: producto.id, empresaId, stockActual: { gte: data.cantidad } },
          data: { stockActual: { decrement: data.cantidad } },
        });
        if (count === 0) throw new AppError(400, "Stock insuficiente para esta salida");
      } else {
        await tx.producto.update({ where: { id: producto.id }, data: { stockActual: data.cantidad } });
      }
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
  })
);

export default router;

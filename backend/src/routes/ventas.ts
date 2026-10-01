import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error";

const router = Router();
router.use(authenticate);

// Con `items`: descuenta stock y calcula el total. Sin `items`: venta rápida con total manual.
const ventaSchema = z
  .object({
    cliente: z.string().optional(),
    total: z.number().positive("Total inválido").optional(),
    items: z
      .array(z.object({ productoId: z.string().min(1), cantidad: z.number().int().positive("Cantidad inválida") }))
      .min(1)
      .optional(),
  })
  .refine((v) => v.items || v.total, { message: "Indica el total o los productos vendidos" });

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ventas = await prisma.venta.findMany({
      where: { empresaId: req.user!.empresaId },
      include: { items: { include: { producto: { select: { nombre: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ ventas });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = ventaSchema.parse(req.body);
    const { empresaId, id: userId } = req.user!;

    const venta = await prisma.$transaction(async (tx) => {
      if (!data.items) {
        return tx.venta.create({
          data: { empresaId, cliente: data.cliente, total: data.total!, creadoPorId: userId },
        });
      }

      let total = new Prisma.Decimal(0);
      const lineas: { productoId: string; cantidad: number; precioUnit: Prisma.Decimal; subtotal: Prisma.Decimal }[] = [];
      for (const it of data.items) {
        const producto = await tx.producto.findFirst({
          where: { id: it.productoId, empresaId, activo: true },
        });
        if (!producto) throw new AppError(404, "Producto no encontrado");
        if (producto.stockActual < it.cantidad) {
          throw new AppError(400, `Stock insuficiente de "${producto.nombre}" (disponible: ${producto.stockActual})`);
        }
        const subtotal = producto.precioVenta.mul(it.cantidad);
        total = total.add(subtotal);
        lineas.push({ productoId: producto.id, cantidad: it.cantidad, precioUnit: producto.precioVenta, subtotal });
        await tx.producto.update({
          where: { id: producto.id },
          data: { stockActual: { decrement: it.cantidad } },
        });
        await tx.movimientoStock.create({
          data: { empresaId, productoId: producto.id, tipo: "SALIDA", cantidad: it.cantidad, motivo: "Venta", creadoPorId: userId },
        });
      }
      return tx.venta.create({
        data: { empresaId, cliente: data.cliente, total, creadoPorId: userId, items: { create: lineas } },
        include: { items: true },
      });
    });

    res.status(201).json({ venta });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(400, err.errors[0].message));
    next(err);
  }
});

// Anular: marca ANULADA y repone el stock de los items
router.post("/:id/anular", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { empresaId, id: userId } = req.user!;
    const venta = await prisma.$transaction(async (tx) => {
      const v = await tx.venta.findFirst({ where: { id: req.params.id, empresaId }, include: { items: true } });
      if (!v) throw new AppError(404, "Venta no encontrada");
      if (v.status === "ANULADA") throw new AppError(409, "La venta ya está anulada");
      for (const it of v.items) {
        await tx.producto.update({
          where: { id: it.productoId },
          data: { stockActual: { increment: it.cantidad } },
        });
        await tx.movimientoStock.create({
          data: { empresaId, productoId: it.productoId, tipo: "ENTRADA", cantidad: it.cantidad, motivo: "Anulación de venta", creadoPorId: userId },
        });
      }
      return tx.venta.update({ where: { id: v.id }, data: { status: "ANULADA" } });
    });
    res.json({ venta });
  } catch (err) {
    next(err);
  }
});

export default router;

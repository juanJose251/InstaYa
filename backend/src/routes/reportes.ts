import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

function desde(rango: string): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (rango === "semana") d.setDate(d.getDate() - 6);
  else if (rango === "mes") d.setDate(d.getDate() - 29);
  return d;
}

// GET /api/reportes/resumen?rango=hoy|semana|mes
router.get("/resumen", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { empresaId } = req.user!;
    const rango = typeof req.query.rango === "string" ? req.query.rango : "hoy";
    const [productos, ventas] = await Promise.all([
      prisma.producto.findMany({ where: { empresaId, activo: true } }),
      prisma.venta.findMany({
        where: { empresaId, status: "COMPLETADA", createdAt: { gte: desde(rango) } },
      }),
    ]);
    res.json({
      rango,
      totalProductos: productos.length,
      stockBajo: productos.filter((p) => p.stockActual <= p.stockMinimo).length,
      valorInventario: productos.reduce((s, p) => s + Number(p.precioCompra) * p.stockActual, 0),
      numeroVentas: ventas.length,
      totalVentas: ventas.reduce((s, v) => s + Number(v.total), 0),
    });
  } catch (err) {
    next(err);
  }
});

export default router;

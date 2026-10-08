import { Router } from "express";
import prisma from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
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
router.get(
  "/resumen",
  asyncHandler(async (req, res) => {
    const { empresaId } = req.user!;
    const rango = typeof req.query.rango === "string" ? req.query.rango : "hoy";
    const [productos, ventas, numeroMovimientos] = await Promise.all([
      prisma.producto.findMany({ where: { empresaId, activo: true } }),
      prisma.venta.findMany({
        where: { empresaId, status: "COMPLETADA", createdAt: { gte: desde(rango) } },
      }),
      prisma.movimientoStock.count({ where: { empresaId, createdAt: { gte: desde(rango) } } }),
    ]);
    res.json({
      rango,
      totalProductos: productos.length,
      stockBajo: productos.filter((p) => p.stockActual <= p.stockMinimo).length,
      valorInventario: productos.reduce((s, p) => s + Number(p.precioCompra) * p.stockActual, 0),
      numeroVentas: ventas.length,
      totalVentas: ventas.reduce((s, v) => s + Number(v.total), 0),
      numeroMovimientos,
    });
  })
);

// GET /api/reportes/top-productos?rango= — los 5 más vendidos (agregación en SQL, no en memoria)
router.get(
  "/top-productos",
  asyncHandler(async (req, res) => {
    const { empresaId } = req.user!;
    const rango = typeof req.query.rango === "string" ? req.query.rango : "mes";
    const productos = await prisma.$queryRaw<{ id: string; nombre: string; unidades: number; ingresos: number }[]>`
      SELECT p.id,
             p.nombre,
             SUM(vi.cantidad)::int AS unidades,
             SUM(vi.subtotal)::float AS ingresos
      FROM venta_items vi
      JOIN ventas v ON v.id = vi."ventaId"
      JOIN productos p ON p.id = vi."productoId"
      WHERE v."empresaId" = ${empresaId}
        AND v.status = 'COMPLETADA'
        AND v."createdAt" >= ${desde(rango)}
      GROUP BY p.id, p.nombre
      ORDER BY unidades DESC
      LIMIT 5`;
    res.json({ rango, productos });
  })
);

export default router;

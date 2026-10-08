import { Router } from "express";
import prisma from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate } from "../middleware/auth";
import { calcularSugerencias, resumenConIA, FilaConsumo, VENTANA_DIAS } from "../lib/reposicion";

const router = Router();
router.use(authenticate);

// GET /api/asistente/reposicion — qué reponer según el ritmo real de ventas (últimos 30 días)
router.get(
  "/reposicion",
  asyncHandler(async (req, res) => {
    const { empresaId } = req.user!;
    const desde = new Date(Date.now() - VENTANA_DIAS * 24 * 60 * 60 * 1000);

    const filas = await prisma.$queryRaw<FilaConsumo[]>`
      SELECT p.id,
             p.nombre,
             p."stockActual" AS stock,
             p."stockMinimo" AS minimo,
             COALESCE(SUM(vi.cantidad) FILTER (
               WHERE v.status = 'COMPLETADA' AND v."createdAt" >= ${desde}
             ), 0)::int AS vendidas
      FROM productos p
      LEFT JOIN venta_items vi ON vi."productoId" = p.id
      LEFT JOIN ventas v ON v.id = vi."ventaId"
      WHERE p."empresaId" = ${empresaId} AND p.activo = true
      GROUP BY p.id`;

    const sugerencias = calcularSugerencias(filas);
    const { resumen, fuente } = await resumenConIA(sugerencias);
    res.json({ resumen, fuente, sugerencias });
  })
);

export default router;

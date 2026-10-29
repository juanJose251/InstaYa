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

// ============ IMPORTACIÓN MASIVA (la "carga inicial" del servicio de implementación) ============

const texto = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const filaSchema = z.object({
  nombre: z.string({ required_error: "Nombre requerido" }).trim().min(1, "Nombre requerido"),
  sku: texto,
  categoria: texto,
  proveedor: texto,
  precioCompra: z.number({ invalid_type_error: "Precio de compra inválido" }).nonnegative("Precio de compra inválido"),
  precioVenta: z.number({ invalid_type_error: "Precio de venta inválido" }).nonnegative("Precio de venta inválido"),
  stock: z.number().int("El stock debe ser entero").nonnegative("Stock inválido").optional(),
  stockMinimo: z.number().int("El mínimo debe ser entero").nonnegative("Stock mínimo inválido").optional(),
});
type Fila = z.infer<typeof filaSchema>;

const importSchema = z.object({
  productos: z.array(z.unknown()).min(1, "El archivo no tiene productos").max(1000, "Máximo 1000 productos por importación"),
});

const clave = (s: string) => s.trim().toLowerCase();

// POST /api/productos/importar — crea o actualiza productos desde una hoja (CSV/Excel convertido por el front).
// Todo o nada: si una fila es inválida no se guarda ninguna y se devuelve la lista de errores por fila.
router.post(
  "/importar",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { productos: crudas } = importSchema.parse(req.body);
    const { empresaId, id: userId } = req.user!;

    const filas: Fila[] = [];
    const errores: { fila: number; error: string }[] = [];
    const skusVistos = new Set<string>();
    crudas.forEach((cruda, i) => {
      const fila = i + 2; // fila 1 = encabezados de la hoja
      const r = filaSchema.safeParse(cruda);
      if (!r.success) {
        errores.push({ fila, error: r.error.errors[0].message });
        return;
      }
      if (r.data.sku) {
        const k = clave(r.data.sku);
        if (skusVistos.has(k)) {
          errores.push({ fila, error: `SKU repetido en el archivo: ${r.data.sku}` });
          return;
        }
        skusVistos.add(k);
      }
      filas.push(r.data);
    });
    if (errores.length > 0) {
      res.status(400).json({ error: `${errores.length} fila(s) con errores. No se importó nada.`, errores: errores.slice(0, 50) });
      return;
    }

    const resultado = await prisma.$transaction(
      async (tx) => {
        // Categorías y proveedores se buscan por nombre dentro de MI empresa y se crean si no existen
        async function resolver(modelo: "categoria" | "proveedor", nombres: (string | undefined)[]) {
          const existentes =
            modelo === "categoria"
              ? await tx.categoria.findMany({ where: { empresaId }, select: { id: true, nombre: true } })
              : await tx.proveedor.findMany({ where: { empresaId }, select: { id: true, nombre: true } });
          const mapa = new Map(existentes.map((e) => [clave(e.nombre), e.id]));
          let creados = 0;
          for (const nombre of nombres) {
            if (!nombre || mapa.has(clave(nombre))) continue;
            const nuevo =
              modelo === "categoria"
                ? await tx.categoria.create({ data: { empresaId, nombre } })
                : await tx.proveedor.create({ data: { empresaId, nombre } });
            mapa.set(clave(nombre), nuevo.id);
            creados++;
          }
          return { mapa, creados };
        }
        const cats = await resolver("categoria", filas.map((f) => f.categoria));
        const provs = await resolver("proveedor", filas.map((f) => f.proveedor));

        // Se reconoce un producto existente por SKU o, si la fila no trae SKU, por nombre
        const actuales = await tx.producto.findMany({
          where: { empresaId },
          select: { id: true, nombre: true, sku: true, stockActual: true },
        });
        const porSku = new Map(actuales.filter((p) => p.sku).map((p) => [clave(p.sku!), p]));
        const porNombre = new Map(actuales.map((p) => [clave(p.nombre), p]));

        let creados = 0;
        let actualizados = 0;
        for (const f of filas) {
          const datos = {
            nombre: f.nombre,
            precioCompra: f.precioCompra,
            precioVenta: f.precioVenta,
            ...(f.stockMinimo !== undefined ? { stockMinimo: f.stockMinimo } : {}),
            categoriaId: f.categoria ? cats.mapa.get(clave(f.categoria)) : undefined,
            proveedorId: f.proveedor ? provs.mapa.get(clave(f.proveedor)) : undefined,
          };
          const existente = f.sku ? porSku.get(clave(f.sku)) : porNombre.get(clave(f.nombre));

          if (existente) {
            const cambiaStock = f.stock !== undefined && f.stock !== existente.stockActual;
            await tx.producto.update({
              where: { id: existente.id },
              data: { ...datos, activo: true, ...(cambiaStock ? { stockActual: f.stock } : {}) },
            });
            if (cambiaStock) {
              await tx.movimientoStock.create({
                data: { empresaId, productoId: existente.id, tipo: "AJUSTE", cantidad: f.stock!, motivo: "Importación de inventario", creadoPorId: userId },
              });
            }
            actualizados++;
          } else {
            const nuevo = await tx.producto.create({
              data: { ...datos, sku: f.sku, empresaId, stockActual: f.stock ?? 0 },
            });
            if (f.stock && f.stock > 0) {
              await tx.movimientoStock.create({
                data: { empresaId, productoId: nuevo.id, tipo: "ENTRADA", cantidad: f.stock, motivo: "Carga inicial (importación)", creadoPorId: userId },
              });
            }
            creados++;
          }
        }
        return { creados, actualizados, categoriasCreadas: cats.creados, proveedoresCreados: provs.creados };
      },
      { timeout: 30_000 }
    );

    res.status(201).json(resultado);
  })
);

export default router;

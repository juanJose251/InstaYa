/**
 * Datos de demostración: una abarrotería con categorías, proveedores, productos y 30 días de ventas.
 * Uso: `npm run seed` (idempotente: si la cuenta demo ya existe, no hace nada).
 * Cuenta: demo@instaya.app / demo1234
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = "demo@instaya.app";

// [nombre, sku, categoría, proveedor, compra, venta, stock, mínimo, ventas diarias aprox.]
const PRODUCTOS: [string, string, string, string, number, number, number, number, number][] = [
  ["Arroz 5 lb", "ARZ-5LB", "Granos", "Distribuidora Central", 2.6, 3.5, 40, 10, 2],
  ["Frijoles rojos 1 lb", "FRJ-1LB", "Granos", "Distribuidora Central", 0.7, 1.1, 60, 15, 3],
  ["Aceite 900 ml", "ACE-900", "Abarrotes", "Distribuidora Central", 2.4, 3.25, 8, 10, 1.5],
  ["Azúcar 2 lb", "AZU-2LB", "Abarrotes", "Distribuidora Central", 1.0, 1.6, 35, 10, 1.5],
  ["Leche 1 L", "LEC-1L", "Lácteos", "Lácteos El Pastor", 0.9, 1.35, 4, 12, 4],
  ["Huevos (docena)", "HUE-12", "Lácteos", "Granja San José", 2.2, 3.0, 20, 6, 1],
  ["Detergente 1 kg", "DET-1KG", "Limpieza", "Distribuidora Central", 2.7, 3.75, 15, 5, 0.5],
  ["Agua 1 L", "AGU-1L", "Bebidas", "Embotelladora Nacional", 0.5, 0.8, 90, 20, 5],
  ["Gaseosa 2 L", "GAS-2L", "Bebidas", "Embotelladora Nacional", 1.3, 1.9, 0, 8, 2],
];

async function main() {
  if (await prisma.usuario.findFirst({ where: { email: EMAIL } })) {
    console.log("La cuenta demo ya existe: no se hace nada.");
    return;
  }

  const empresa = await prisma.empresa.create({
    data: { nombre: "Abarrotería La Esperanza (demo)", giro: "Abarrotes", trialFin: new Date(Date.now() + 15 * 864e5) },
  });
  const admin = await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      nombre: "Dueña Demo",
      email: EMAIL,
      passwordHash: await bcrypt.hash("demo1234", 10),
      rol: "ADMIN",
    },
  });
  const empresaId = empresa.id;

  const categorias = new Map<string, string>();
  for (const nombre of new Set(PRODUCTOS.map((p) => p[2]))) {
    categorias.set(nombre, (await prisma.categoria.create({ data: { empresaId, nombre } })).id);
  }
  const proveedores = new Map<string, string>();
  for (const nombre of new Set(PRODUCTOS.map((p) => p[3]))) {
    proveedores.set(nombre, (await prisma.proveedor.create({ data: { empresaId, nombre } })).id);
  }

  let ventas = 0;
  for (const [nombre, sku, cat, prov, compra, venta, stock, minimo, porDia] of PRODUCTOS) {
    const producto = await prisma.producto.create({
      data: {
        empresaId,
        nombre,
        sku,
        categoriaId: categorias.get(cat),
        proveedorId: proveedores.get(prov),
        precioCompra: compra,
        precioVenta: venta,
        stockActual: stock,
        stockMinimo: minimo,
      },
    });
    await prisma.movimientoStock.create({
      data: { empresaId, productoId: producto.id, tipo: "ENTRADA", cantidad: stock, motivo: "Carga inicial", creadoPorId: admin.id },
    });

    // Historial de ventas: algunos días sin venta, cantidad variable alrededor del ritmo diario.
    for (let dia = 29; dia >= 0; dia--) {
      const cantidad = Math.round(porDia * (0.5 + ((dia * 7 + nombre.length) % 10) / 10));
      if (cantidad < 1 || (dia + nombre.length) % 4 === 0) continue;
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - dia);
      fecha.setHours(9 + (dia % 9), 0, 0, 0);
      if (fecha.getTime() > Date.now()) fecha.setTime(Date.now() - 60_000);
      const subtotal = new Prisma.Decimal(venta).mul(cantidad);
      await prisma.venta.create({
        data: {
          empresaId,
          total: subtotal,
          creadoPorId: admin.id,
          createdAt: fecha,
          items: { create: [{ productoId: producto.id, cantidad, precioUnit: venta, subtotal }] },
        },
      });
      ventas++;
    }
  }

  console.log(`Demo lista: ${PRODUCTOS.length} productos, ${categorias.size} categorías, ${proveedores.size} proveedores, ${ventas} ventas.`);
  console.log(`Ingresa con ${EMAIL} / demo1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

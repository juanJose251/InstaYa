/**
 * Pruebas de integración: Express + Prisma + PostgreSQL reales (sin mocks).
 * Cubren lo que los tests unitarios no pueden: transacciones, restricciones únicas,
 * consultas SQL crudas y la atomicidad del descuento de stock.
 *
 * Requieren DATABASE_URL apuntando a una base con las migraciones aplicadas
 * (`npx prisma migrate deploy`). En CI se levanta un servicio postgres.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app";
import prisma from "../lib/prisma";

const sufijo = Date.now().toString(36);

async function registrar(nombre: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      empresa: { nombre: `${nombre} ${sufijo}` },
      admin: { nombre: `Admin ${nombre}`, email: `${nombre.toLowerCase()}-${sufijo}@test.com`, password: "secreto123" },
    });
  expect(res.status).toBe(201);
  return { token: `Bearer ${res.body.token as string}`, empresaId: res.body.empresa.id as string };
}

const a = {} as Awaited<ReturnType<typeof registrar>>;
const b = {} as Awaited<ReturnType<typeof registrar>>;

beforeAll(async () => {
  Object.assign(a, await registrar("EmpresaA"));
  Object.assign(b, await registrar("EmpresaB"));
});

afterAll(async () => {
  // Cascade borra usuarios, productos y categorías; ventas y movimientos tienen onDelete Restrict hacia producto/usuario,
  // así que se limpian primero.
  const ids = [a.empresaId, b.empresaId];
  await prisma.ventaItem.deleteMany({ where: { venta: { empresaId: { in: ids } } } });
  await prisma.venta.deleteMany({ where: { empresaId: { in: ids } } });
  await prisma.movimientoStock.deleteMany({ where: { empresaId: { in: ids } } });
  await prisma.empresa.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

async function crearProducto(token: string, datos: Record<string, unknown>) {
  const res = await request(app).post("/api/productos").set("Authorization", token).send(datos);
  expect(res.status).toBe(201);
  return res.body.producto as { id: string; stockActual: number };
}

async function ponerStock(token: string, productoId: string, cantidad: number) {
  const res = await request(app)
    .post("/api/movimientos")
    .set("Authorization", token)
    .send({ productoId, tipo: "ENTRADA", cantidad, motivo: "Carga inicial" });
  expect(res.status).toBe(201);
}

describe("inventario y ventas contra PostgreSQL", () => {
  it("SKU repetido en la misma empresa da 409 (restricción única real), pero otra empresa puede usarlo", async () => {
    await crearProducto(a.token, { nombre: "Arroz", sku: "ARZ", precioCompra: 1, precioVenta: 2 });
    const repetido = await request(app)
      .post("/api/productos")
      .set("Authorization", a.token)
      .send({ nombre: "Otro", sku: "ARZ", precioCompra: 1, precioVenta: 2 });
    expect(repetido.status).toBe(409);
    await crearProducto(b.token, { nombre: "Arroz B", sku: "ARZ", precioCompra: 1, precioVenta: 2 });
  });

  it("una empresa no puede leer ni usar productos y categorías de otra", async () => {
    const prodB = await crearProducto(b.token, { nombre: "Solo de B", precioCompra: 1, precioVenta: 2 });
    const catB = await request(app).post("/api/categorias").set("Authorization", b.token).send({ nombre: "Cat B" });

    expect((await request(app).get(`/api/productos/${prodB.id}`).set("Authorization", a.token)).status).toBe(404);

    const usaCategoriaAjena = await request(app)
      .post("/api/productos")
      .set("Authorization", a.token)
      .send({ nombre: "Intruso", precioCompra: 1, precioVenta: 2, categoriaId: catB.body.categoria.id });
    expect(usaCategoriaAjena.status).toBe(400);

    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", a.token)
      .send({ items: [{ productoId: prodB.id, cantidad: 1 }] });
    expect(venta.status).toBe(404);
  });

  it("venta con items: total calculado en servidor, stock descontado y anulación que lo repone", async () => {
    const p = await crearProducto(a.token, { nombre: "Frijoles", precioCompra: 1, precioVenta: 2.5, stockMinimo: 2 });
    await ponerStock(a.token, p.id, 10);

    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", a.token)
      .send({ items: [{ productoId: p.id, cantidad: 4 }], total: 999 });
    expect(venta.status).toBe(201);
    expect(Number(venta.body.venta.total)).toBe(10);
    expect((await prisma.producto.findUnique({ where: { id: p.id } }))!.stockActual).toBe(6);

    const anulada = await request(app).post(`/api/ventas/${venta.body.venta.id}/anular`).set("Authorization", a.token);
    expect(anulada.status).toBe(200);
    expect((await prisma.producto.findUnique({ where: { id: p.id } }))!.stockActual).toBe(10);

    const otraVez = await request(app).post(`/api/ventas/${venta.body.venta.id}/anular`).set("Authorization", a.token);
    expect(otraVez.status).toBe(409);
  });

  it("30 ventas simultáneas de 1 unidad con stock 5: se concretan exactamente 5 y el stock nunca es negativo", async () => {
    const p = await crearProducto(a.token, { nombre: "Escaso", precioCompra: 1, precioVenta: 5 });
    await ponerStock(a.token, p.id, 5);

    const enviar = () =>
      request(app).post("/api/ventas").set("Authorization", a.token).send({ items: [{ productoId: p.id, cantidad: 1 }] });
    const resultados = await Promise.all(Array.from({ length: 30 }, enviar));

    expect(resultados.filter((r) => r.status === 201)).toHaveLength(5);
    expect(resultados.filter((r) => r.status === 400)).toHaveLength(25);
    expect((await prisma.producto.findUnique({ where: { id: p.id } }))!.stockActual).toBe(0);
  });

  it("movimientos simultáneos no se pisan: 10 entradas de 1 unidad suman exactamente 10", async () => {
    const p = await crearProducto(a.token, { nombre: "Contador", precioCompra: 1, precioVenta: 2 });
    const resultados = await Promise.all(Array.from({ length: 10 }, () => ponerStock(a.token, p.id, 1)));
    expect(resultados).toHaveLength(10);
    expect((await prisma.producto.findUnique({ where: { id: p.id } }))!.stockActual).toBe(10);
  });

  it("top-productos y reposición (SQL crudo con JOIN/GROUP BY) devuelven datos coherentes", async () => {
    const p = await crearProducto(a.token, { nombre: "Estrella", precioCompra: 1, precioVenta: 4, stockMinimo: 1 });
    await ponerStock(a.token, p.id, 30);
    for (const cantidad of [5, 5]) {
      await request(app).post("/api/ventas").set("Authorization", a.token).send({ items: [{ productoId: p.id, cantidad }] });
    }

    const top = await request(app).get("/api/reportes/top-productos?rango=mes").set("Authorization", a.token);
    expect(top.status).toBe(200);
    const fila = top.body.productos.find((x: { id: string }) => x.id === p.id);
    expect(fila).toMatchObject({ unidades: 10, ingresos: 40 });

    // 10 vendidas en 30 días y 20 en stock = 60 días de cobertura: no necesita reposición
    const repo = await request(app).get("/api/asistente/reposicion").set("Authorization", a.token);
    expect(repo.status).toBe(200);
    expect(repo.body.sugerencias.find((s: { productoId: string }) => s.productoId === p.id)).toBeUndefined();

    // el reporte de la empresa B no ve las ventas de A
    const topB = await request(app).get("/api/reportes/top-productos").set("Authorization", b.token);
    expect(topB.body.productos).toEqual([]);
  });
});

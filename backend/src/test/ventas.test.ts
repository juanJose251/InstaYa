import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { Prisma } from "@prisma/client";

vi.mock("../lib/prisma", async () => ({ default: (await import("./helpers")).prismaMock }));

import app from "../app";
import { prismaMock, resetPrismaMock, loginAs, adminA } from "./helpers";

beforeEach(() => resetPrismaMock());

const producto = (stock: number) => ({
  id: "p1",
  nombre: "Arroz",
  stockActual: stock,
  precioVenta: new Prisma.Decimal("2.50"),
});

describe("POST /api/ventas", () => {
  it("400 si no se indica total ni productos", async () => {
    const res = await request(app).post("/api/ventas").set("Authorization", loginAs(adminA)).send({});
    expect(res.status).toBe(400);
  });

  it("400 si no hay stock suficiente y no descuenta nada", async () => {
    prismaMock.producto.findFirst.mockResolvedValue(producto(1));
    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", loginAs(adminA))
      .send({ items: [{ productoId: "p1", cantidad: 5 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Stock insuficiente de "Arroz"/);
    expect(prismaMock.producto.update).not.toHaveBeenCalled();
    expect(prismaMock.venta.create).not.toHaveBeenCalled();
  });

  it("carrera: si otra venta se llevó el stock entre la lectura y el descuento, da 400 y no crea la venta", async () => {
    prismaMock.producto.findFirst.mockResolvedValue(producto(1));
    prismaMock.producto.updateMany.mockResolvedValue({ count: 0 }); // la condición gte ya no se cumple
    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", loginAs(adminA))
      .send({ items: [{ productoId: "p1", cantidad: 1 }] });
    expect(res.status).toBe(400);
    expect(prismaMock.venta.create).not.toHaveBeenCalled();
  });

  it("404 si el producto no existe en mi empresa", async () => {
    prismaMock.producto.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", loginAs(adminA))
      .send({ items: [{ productoId: "ajeno", cantidad: 1 }] });
    expect(res.status).toBe(404);
  });

  it("calcula el total con el precio del servidor, descuenta stock y registra el movimiento", async () => {
    prismaMock.producto.findFirst.mockResolvedValue(producto(10));
    prismaMock.producto.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.venta.create.mockImplementation(async ({ data }: { data: { total: Prisma.Decimal } }) => ({ id: "v1", ...data }));

    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", loginAs(adminA))
      .send({ items: [{ productoId: "p1", cantidad: 4 }], total: 999 }); // el total del cliente se ignora

    expect(res.status).toBe(201);
    expect(Number(res.body.venta.total)).toBe(10); // 4 x 2.50
    expect(prismaMock.producto.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", empresaId: "empresa-a", stockActual: { gte: 4 } },
      data: { stockActual: { decrement: 4 } },
    });
    expect(prismaMock.movimientoStock.create.mock.calls[0][0].data).toMatchObject({
      tipo: "SALIDA",
      cantidad: 4,
      empresaId: "empresa-a",
    });
  });
});

describe("POST /api/ventas/:id/anular", () => {
  it("409 si ya estaba anulada", async () => {
    prismaMock.venta.findFirst.mockResolvedValue({ id: "v1", status: "ANULADA", items: [] });
    const res = await request(app).post("/api/ventas/v1/anular").set("Authorization", loginAs(adminA));
    expect(res.status).toBe(409);
  });

  it("repone el stock de cada item y marca la venta como ANULADA", async () => {
    prismaMock.venta.findFirst.mockResolvedValue({
      id: "v1",
      status: "COMPLETADA",
      items: [{ productoId: "p1", cantidad: 3 }],
    });
    prismaMock.venta.update.mockResolvedValue({ id: "v1", status: "ANULADA" });

    const res = await request(app).post("/api/ventas/v1/anular").set("Authorization", loginAs(adminA));

    expect(res.status).toBe(200);
    expect(prismaMock.producto.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { stockActual: { increment: 3 } },
    });
    expect(prismaMock.venta.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { status: "ANULADA" } });
  });
});

describe("POST /api/movimientos", () => {
  it("400 si una SALIDA deja el stock negativo", async () => {
    prismaMock.producto.findFirst.mockResolvedValue(producto(2));
    prismaMock.producto.updateMany.mockResolvedValue({ count: 0 }); // el WHERE stockActual >= cantidad no se cumple
    const res = await request(app)
      .post("/api/movimientos")
      .set("Authorization", loginAs(adminA))
      .send({ productoId: "p1", tipo: "SALIDA", cantidad: 5 });
    expect(res.status).toBe(400);
    expect(prismaMock.producto.update).not.toHaveBeenCalled();
  });

  it("ENTRADA suma de forma atómica y SALIDA descuenta solo si hay stock", async () => {
    prismaMock.producto.findFirst.mockResolvedValue(producto(2));
    prismaMock.movimientoStock.create.mockResolvedValue({ id: "m1" });
    prismaMock.producto.updateMany.mockResolvedValue({ count: 1 });

    const entrada = await request(app)
      .post("/api/movimientos")
      .set("Authorization", loginAs(adminA))
      .send({ productoId: "p1", tipo: "ENTRADA", cantidad: 7 });
    expect(entrada.status).toBe(201);
    expect(prismaMock.producto.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { stockActual: { increment: 7 } } });

    const salida = await request(app)
      .post("/api/movimientos")
      .set("Authorization", loginAs(adminA))
      .send({ productoId: "p1", tipo: "SALIDA", cantidad: 2 });
    expect(salida.status).toBe(201);
    expect(prismaMock.producto.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", empresaId: "empresa-a", stockActual: { gte: 2 } },
      data: { stockActual: { decrement: 2 } },
    });
  });

  it("AJUSTE fija el stock al valor indicado", async () => {
    prismaMock.producto.findFirst.mockResolvedValue(producto(2));
    prismaMock.movimientoStock.create.mockResolvedValue({ id: "m1" });
    const res = await request(app)
      .post("/api/movimientos")
      .set("Authorization", loginAs(adminA))
      .send({ productoId: "p1", tipo: "AJUSTE", cantidad: 20 });
    expect(res.status).toBe(201);
    expect(prismaMock.producto.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { stockActual: 20 } });
  });
});

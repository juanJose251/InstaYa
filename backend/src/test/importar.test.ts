import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../lib/prisma", async () => ({ default: (await import("./helpers")).prismaMock }));

import app from "../app";
import { prismaMock, resetPrismaMock, loginAs, adminA, empleadoA } from "./helpers";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.categoria.findMany.mockResolvedValue([{ id: "cat-granos", nombre: "Granos" }]);
  prismaMock.proveedor.findMany.mockResolvedValue([]);
  prismaMock.categoria.create.mockImplementation(async ({ data }: { data: { nombre: string } }) => ({ id: `cat-${data.nombre}` }));
  prismaMock.proveedor.create.mockImplementation(async ({ data }: { data: { nombre: string } }) => ({ id: `prov-${data.nombre}` }));
  prismaMock.producto.create.mockImplementation(async ({ data }: { data: { nombre: string } }) => ({ id: `nuevo-${data.nombre}`, ...data }));
  prismaMock.producto.update.mockResolvedValue({});
  prismaMock.movimientoStock.create.mockResolvedValue({});
});

const fila = (extra = {}) => ({ nombre: "Arroz 5 lb", sku: "ARZ-5LB", categoria: "granos", precioCompra: 2.6, precioVenta: 3.5, stock: 40, stockMinimo: 10, ...extra });

describe("POST /api/productos/importar", () => {
  it("solo un ADMIN puede importar (403 para EMPLEADO)", async () => {
    const res = await request(app).post("/api/productos/importar").set("Authorization", loginAs(empleadoA)).send({ productos: [fila()] });
    expect(res.status).toBe(403);
  });

  it("todo o nada: con una fila inválida no guarda ninguna y dice qué fila falla", async () => {
    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", loginAs(adminA))
      .send({ productos: [fila(), fila({ sku: "OTRO", precioVenta: -1 })] });
    expect(res.status).toBe(400);
    expect(res.body.errores).toEqual([{ fila: 3, error: "Precio de venta inválido" }]);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza SKU repetido dentro del mismo archivo", async () => {
    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", loginAs(adminA))
      .send({ productos: [fila(), fila({ nombre: "Arroz otra marca", sku: "arz-5lb" })] });
    expect(res.status).toBe(400);
    expect(res.body.errores[0].error).toMatch(/SKU repetido/);
  });

  it("crea productos nuevos con su stock inicial y una ENTRADA de 'Carga inicial'", async () => {
    prismaMock.producto.findMany.mockResolvedValue([]);
    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", loginAs(adminA))
      .send({ productos: [fila(), fila({ nombre: "Leche 1 L", sku: "LEC-1L", categoria: "Lácteos", proveedor: "El Pastor", stock: 0 })] });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ creados: 2, actualizados: 0, categoriasCreadas: 1, proveedoresCreados: 1 });

    const arroz = prismaMock.producto.create.mock.calls[0][0].data;
    expect(arroz).toMatchObject({ empresaId: "empresa-a", stockActual: 40, categoriaId: "cat-granos" }); // categoría existente, sin importar mayúsculas
    const mov = prismaMock.movimientoStock.create.mock.calls;
    expect(mov).toHaveLength(1); // la leche entra con stock 0: sin movimiento
    expect(mov[0][0].data).toMatchObject({ tipo: "ENTRADA", cantidad: 40, creadoPorId: "user-a", empresaId: "empresa-a" });
  });

  it("actualiza por SKU (no duplica) y registra un AJUSTE solo si cambia el stock", async () => {
    prismaMock.producto.findMany.mockResolvedValue([
      { id: "p1", nombre: "Arroz", sku: "ARZ-5LB", stockActual: 12 },
      { id: "p2", nombre: "Azúcar 2 lb", sku: null, stockActual: 35 },
    ]);
    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", loginAs(adminA))
      .send({ productos: [fila({ precioVenta: 3.75 }), { nombre: "azúcar 2 lb", precioCompra: 1, precioVenta: 1.6, stock: 35 }] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ creados: 0, actualizados: 2 });
    expect(prismaMock.producto.create).not.toHaveBeenCalled();
    expect(prismaMock.producto.update.mock.calls[0][0]).toMatchObject({ where: { id: "p1" }, data: { precioVenta: 3.75, stockActual: 40 } });
    const mov = prismaMock.movimientoStock.create.mock.calls;
    expect(mov).toHaveLength(1);
    expect(mov[0][0].data).toMatchObject({ productoId: "p1", tipo: "AJUSTE", cantidad: 40 });
  });

  it("las búsquedas de categorías, proveedores y productos quedan dentro de mi empresa", async () => {
    prismaMock.producto.findMany.mockResolvedValue([]);
    await request(app).post("/api/productos/importar").set("Authorization", loginAs(adminA)).send({ productos: [fila()] });
    expect(prismaMock.categoria.findMany.mock.calls[0][0].where).toEqual({ empresaId: "empresa-a" });
    expect(prismaMock.proveedor.findMany.mock.calls[0][0].where).toEqual({ empresaId: "empresa-a" });
    expect(prismaMock.producto.findMany.mock.calls[0][0].where).toEqual({ empresaId: "empresa-a" });
  });

  it("archivo vacío: 400", async () => {
    const res = await request(app).post("/api/productos/importar").set("Authorization", loginAs(adminA)).send({ productos: [] });
    expect(res.status).toBe(400);
  });
});

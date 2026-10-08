import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../lib/prisma", async () => ({ default: (await import("./helpers")).prismaMock }));

import app from "../app";
import { prismaMock, resetPrismaMock, loginAs, adminA, empleadoA } from "./helpers";

beforeEach(() => resetPrismaMock());

describe("categorías", () => {
  it("lista solo las categorías de mi empresa", async () => {
    prismaMock.categoria.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/categorias").set("Authorization", loginAs(empleadoA));
    expect(res.status).toBe(200);
    expect(prismaMock.categoria.findMany.mock.calls[0][0].where).toEqual({ empresaId: "empresa-a" });
  });

  it("un EMPLEADO no puede crear (403) y un ADMIN sí (201)", async () => {
    const denegado = await request(app)
      .post("/api/categorias")
      .set("Authorization", loginAs(empleadoA))
      .send({ nombre: "Lácteos" });
    expect(denegado.status).toBe(403);

    prismaMock.categoria.create.mockImplementation(async ({ data }: { data: unknown }) => data);
    const creada = await request(app)
      .post("/api/categorias")
      .set("Authorization", loginAs(adminA))
      .send({ nombre: "Lácteos", empresaId: "empresa-b" });
    expect(creada.status).toBe(201);
    expect(creada.body.categoria.empresaId).toBe("empresa-a"); // ignora la empresa del cuerpo
  });

  it("nombre vacío da 400", async () => {
    const res = await request(app).post("/api/categorias").set("Authorization", loginAs(adminA)).send({ nombre: "  " });
    expect(res.status).toBe(400);
  });

  it("editar o borrar una categoría de otra empresa da 404", async () => {
    prismaMock.categoria.findFirst.mockResolvedValue(null);
    const put = await request(app).put("/api/categorias/de-b").set("Authorization", loginAs(adminA)).send({ nombre: "X" });
    expect(put.status).toBe(404);
    prismaMock.categoria.findFirst.mockResolvedValue(null);
    const del = await request(app).delete("/api/categorias/de-b").set("Authorization", loginAs(adminA));
    expect(del.status).toBe(404);
    expect(prismaMock.categoria.delete).not.toHaveBeenCalled();
  });

  it("borrar una categoría propia da 204", async () => {
    prismaMock.categoria.findFirst.mockResolvedValue({ id: "c1" });
    const res = await request(app).delete("/api/categorias/c1").set("Authorization", loginAs(adminA));
    expect(res.status).toBe(204);
    expect(prismaMock.categoria.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});

describe("proveedores", () => {
  it("lista solo proveedores activos de mi empresa", async () => {
    prismaMock.proveedor.findMany.mockResolvedValue([]);
    await request(app).get("/api/proveedores").set("Authorization", loginAs(adminA));
    expect(prismaMock.proveedor.findMany.mock.calls[0][0].where).toEqual({ empresaId: "empresa-a", activo: true });
  });

  it("valida el correo", async () => {
    const res = await request(app)
      .post("/api/proveedores")
      .set("Authorization", loginAs(adminA))
      .send({ nombre: "Distribuidora", email: "no-es-correo" });
    expect(res.status).toBe(400);
  });

  it("borrar es baja lógica (activo = false)", async () => {
    prismaMock.proveedor.findFirst.mockResolvedValue({ id: "p1" });
    const res = await request(app).delete("/api/proveedores/p1").set("Authorization", loginAs(adminA));
    expect(res.status).toBe(204);
    expect(prismaMock.proveedor.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { activo: false } });
  });
});

describe("productos con categoría y proveedor", () => {
  const nuevo = { nombre: "Leche", precioCompra: 1, precioVenta: 2 };

  it("rechaza una categoría que no es de mi empresa (400) y no crea el producto", async () => {
    prismaMock.categoria.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/productos")
      .set("Authorization", loginAs(adminA))
      .send({ ...nuevo, categoriaId: "categoria-de-b" });
    expect(res.status).toBe(400);
    expect(prismaMock.categoria.findFirst).toHaveBeenCalledWith({ where: { id: "categoria-de-b", empresaId: "empresa-a" } });
    expect(prismaMock.producto.create).not.toHaveBeenCalled();
  });

  it("rechaza un proveedor ajeno al editar", async () => {
    prismaMock.producto.findFirst.mockResolvedValue({ id: "p1" });
    prismaMock.proveedor.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .put("/api/productos/p1")
      .set("Authorization", loginAs(adminA))
      .send({ proveedorId: "proveedor-de-b" });
    expect(res.status).toBe(400);
    expect(prismaMock.producto.update).not.toHaveBeenCalled();
  });

  it("acepta una categoría propia", async () => {
    prismaMock.categoria.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.producto.create.mockImplementation(async ({ data }: { data: unknown }) => data);
    const res = await request(app)
      .post("/api/productos")
      .set("Authorization", loginAs(adminA))
      .send({ ...nuevo, categoriaId: "c1" });
    expect(res.status).toBe(201);
  });
});

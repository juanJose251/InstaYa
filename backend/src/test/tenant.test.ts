import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../lib/prisma", async () => ({ default: (await import("./helpers")).prismaMock }));

import app from "../app";
import { prismaMock, resetPrismaMock, loginAs, adminA, empleadoA } from "./helpers";

beforeEach(() => resetPrismaMock());

describe("aislamiento multi-tenant", () => {
  it("el listado de productos solo consulta la empresa del token", async () => {
    prismaMock.producto.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/productos").set("Authorization", loginAs(adminA));
    expect(res.status).toBe(200);
    expect(prismaMock.producto.findMany.mock.calls[0][0].where.empresaId).toBe("empresa-a");
  });

  it("pedir un producto de otra empresa da 404 (la consulta lleva empresaId)", async () => {
    prismaMock.producto.findFirst.mockResolvedValue(null); // no existe para empresa-a
    const res = await request(app).get("/api/productos/producto-de-b").set("Authorization", loginAs(adminA));
    expect(res.status).toBe(404);
    expect(prismaMock.producto.findFirst).toHaveBeenLastCalledWith({
      where: { id: "producto-de-b", empresaId: "empresa-a" },
    });
  });

  it("crear un producto ignora una empresaId enviada en el cuerpo", async () => {
    prismaMock.producto.create.mockImplementation(async ({ data }: { data: unknown }) => data);
    const res = await request(app)
      .post("/api/productos")
      .set("Authorization", loginAs(adminA))
      .send({ nombre: "X", precioCompra: 1, precioVenta: 2, empresaId: "empresa-b" });
    expect(res.status).toBe(201);
    expect(res.body.producto.empresaId).toBe("empresa-a");
  });

  it("tenantGuard: crear usuario con otra empresaId en el cuerpo da 403", async () => {
    const res = await request(app)
      .post("/api/usuarios")
      .set("Authorization", loginAs(adminA))
      .send({ nombre: "Nuevo", email: "n@a.com", password: "123456", empresaId: "empresa-b" });
    expect(res.status).toBe(403);
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
  });

  it("el listado de usuarios solo trae los de mi empresa", async () => {
    prismaMock.usuario.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/usuarios").set("Authorization", loginAs(adminA));
    expect(res.status).toBe(200);
    expect(prismaMock.usuario.findMany.mock.calls[0][0].where).toEqual({ empresaId: "empresa-a" });
  });

  it("anular la venta de otra empresa da 404", async () => {
    prismaMock.venta.findFirst.mockResolvedValue(null);
    const res = await request(app).post("/api/ventas/venta-de-b/anular").set("Authorization", loginAs(adminA));
    expect(res.status).toBe(404);
    expect(prismaMock.venta.findFirst.mock.calls[0][0].where).toEqual({ id: "venta-de-b", empresaId: "empresa-a" });
  });
});

describe("roles", () => {
  it("un EMPLEADO no puede crear productos (403)", async () => {
    const res = await request(app)
      .post("/api/productos")
      .set("Authorization", loginAs(empleadoA))
      .send({ nombre: "X", precioCompra: 1, precioVenta: 2 });
    expect(res.status).toBe(403);
    expect(prismaMock.producto.create).not.toHaveBeenCalled();
  });

  it("un EMPLEADO no puede crear usuarios (403)", async () => {
    const res = await request(app)
      .post("/api/usuarios")
      .set("Authorization", loginAs(empleadoA))
      .send({ nombre: "Otro", email: "o@a.com", password: "123456" });
    expect(res.status).toBe(403);
  });

  it("un ADMIN sí puede crear un empleado en su empresa", async () => {
    const auth = loginAs(adminA); // 1ª consulta: authenticate
    prismaMock.usuario.findFirst.mockResolvedValueOnce(null); // 2ª: correo libre
    prismaMock.usuario.create.mockImplementation(async ({ data }: { data: { nombre: string; email: string; rol: string } }) => ({
      id: "nuevo",
      ...data,
    }));
    const res = await request(app)
      .post("/api/usuarios")
      .set("Authorization", auth)
      .send({ nombre: "Nuevo", email: "N@a.com", password: "123456" });
    expect(res.status).toBe(201);
    const data = prismaMock.usuario.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ empresaId: "empresa-a", email: "n@a.com", rol: "EMPLEADO" });
  });
});

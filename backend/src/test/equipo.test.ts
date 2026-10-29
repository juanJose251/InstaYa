import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../lib/prisma", async () => ({ default: (await import("./helpers")).prismaMock }));

import app from "../app";
import { prismaMock, resetPrismaMock, loginAs, adminA, empleadoA } from "./helpers";

beforeEach(() => resetPrismaMock());

describe("GET /api/usuarios/me", () => {
  it("devuelve también la empresa y el estado del plan (para recargar la página sin perderlos)", async () => {
    prismaMock.empresa.findFirst.mockResolvedValue({ id: "empresa-a", nombre: "Tienda A", plan: "PRUEBA" });
    const res = await request(app).get("/api/usuarios/me").set("Authorization", loginAs(adminA));
    expect(res.status).toBe(200);
    expect(res.body.empresa.nombre).toBe("Tienda A");
    expect(prismaMock.empresa.findFirst.mock.calls[0][0].where).toEqual({ id: "empresa-a" });
    expect(res.body.suscripcion).toBeDefined();
  });
});

describe("PUT /api/usuarios/:id (equipo)", () => {
  it("un EMPLEADO no puede cambiar usuarios (403)", async () => {
    const res = await request(app).put("/api/usuarios/u2").set("Authorization", loginAs(empleadoA)).send({ activo: false });
    expect(res.status).toBe(403);
  });

  it("un usuario de otra empresa da 404", async () => {
    const auth = loginAs(adminA);
    prismaMock.usuario.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).put("/api/usuarios/de-b").set("Authorization", auth).send({ activo: false });
    expect(res.status).toBe(404);
    expect(prismaMock.usuario.findFirst.mock.calls[1][0].where).toEqual({ id: "de-b", empresaId: "empresa-a" });
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });

  it("el ADMIN no puede desactivarse a sí mismo", async () => {
    const auth = loginAs(adminA); // 1.ª consulta: authenticate
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ id: "user-a", empresaId: "empresa-a" }); // 2.ª: la ruta
    const res = await request(app).put("/api/usuarios/user-a").set("Authorization", auth).send({ activo: false });
    expect(res.status).toBe(400);
  });

  it("desactiva a un empleado y cambia su contraseña sin devolver el hash", async () => {
    const auth = loginAs(adminA);
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ id: "u2", empresaId: "empresa-a" });
    prismaMock.usuario.update.mockResolvedValue({ id: "u2", nombre: "Emp", activo: false });
    const res = await request(app).put("/api/usuarios/u2").set("Authorization", auth).send({ activo: false, password: "nueva123" });
    expect(res.status).toBe(200);
    const data = prismaMock.usuario.update.mock.calls[0][0].data;
    expect(data.activo).toBe(false);
    expect(data.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(data.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("no acepta cambiar la empresa del usuario (campo desconocido = 400)", async () => {
    const res = await request(app).put("/api/usuarios/u2").set("Authorization", loginAs(adminA)).send({ empresaId: "empresa-b" });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/empresa", () => {
  it("el ADMIN edita los datos de SU empresa, y no puede tocar el plan", async () => {
    prismaMock.empresa.update.mockResolvedValue({ id: "empresa-a", nombre: "Tienda A2" });
    const ok = await request(app).put("/api/empresa").set("Authorization", loginAs(adminA)).send({ nombre: "Tienda A2", telefono: "2222-0000" });
    expect(ok.status).toBe(200);
    expect(prismaMock.empresa.update.mock.calls[0][0].where).toEqual({ id: "empresa-a" });

    const plan = await request(app).put("/api/empresa").set("Authorization", loginAs(adminA)).send({ plan: "BASICO" });
    expect(plan.status).toBe(400);
  });

  it("un EMPLEADO no puede editar la empresa", async () => {
    const res = await request(app).put("/api/empresa").set("Authorization", loginAs(empleadoA)).send({ nombre: "X" });
    expect(res.status).toBe(403);
  });
});

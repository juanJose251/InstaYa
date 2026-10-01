import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

vi.mock("../lib/prisma", async () => ({ default: (await import("./helpers")).prismaMock }));

import app from "../app";
import { env } from "../config/env";
import { prismaMock, resetPrismaMock, loginAs, adminA } from "./helpers";

beforeEach(() => resetPrismaMock());

const registerBody = {
  empresa: { nombre: "Tienda A" },
  admin: { nombre: "Admin A", email: "Admin@A.com", password: "secreto1" },
};

describe("POST /api/auth/register", () => {
  it("rechaza datos inválidos con 400 y el mensaje de Zod", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...registerBody, admin: { ...registerBody.admin, email: "no-es-email" } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Email inválido");
  });

  it("rechaza un correo ya registrado con 409", async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({ id: "x" });
    const res = await request(app).post("/api/auth/register").send(registerBody);
    expect(res.status).toBe(409);
  });

  it("crea la empresa con un usuario ADMIN y devuelve un token", async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(null);
    prismaMock.empresa.create.mockImplementation(async ({ data }: { data: { nombre: string; usuarios: { create: { email: string; rol: string } } } }) => ({
      id: "empresa-a",
      nombre: data.nombre,
      trialFin: new Date(),
      usuarios: [{ id: "user-a", empresaId: "empresa-a", ...data.usuarios.create, nombre: "Admin A" }],
    }));

    const res = await request(app).post("/api/auth/register").send(registerBody);

    expect(res.status).toBe(201);
    const created = prismaMock.empresa.create.mock.calls[0][0].data.usuarios.create;
    expect(created.rol).toBe("ADMIN");
    expect(created.email).toBe("admin@a.com"); // se guarda en minúsculas
    expect(created.passwordHash).not.toBe("secreto1"); // nunca en texto plano
    const payload = jwt.verify(res.body.token, env.jwtSecret) as jwt.JwtPayload;
    expect(payload.empresaId).toBe("empresa-a");
  });
});

describe("POST /api/auth/login", () => {
  const stored = async (overrides = {}) => ({
    ...adminA,
    activo: true,
    passwordHash: await bcrypt.hash("secreto1", 4),
    empresa: { id: "empresa-a", nombre: "Tienda A", activa: true, trialFin: null },
    ...overrides,
  });

  it("401 si el correo no existe", async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(null);
    const res = await request(app).post("/api/auth/login").send({ email: "x@x.com", password: "a" });
    expect(res.status).toBe(401);
  });

  it("401 con contraseña incorrecta (mismo mensaje que correo inexistente)", async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(await stored());
    const res = await request(app).post("/api/auth/login").send({ email: "admin@a.com", password: "mala" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciales inválidas");
  });

  it("403 si el usuario está desactivado", async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(await stored({ activo: false }));
    const res = await request(app).post("/api/auth/login").send({ email: "admin@a.com", password: "secreto1" });
    expect(res.status).toBe(403);
  });

  it("403 si la empresa está inactiva", async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(
      await stored({ empresa: { id: "empresa-a", nombre: "T", activa: false, trialFin: null } })
    );
    const res = await request(app).post("/api/auth/login").send({ email: "admin@a.com", password: "secreto1" });
    expect(res.status).toBe(403);
  });

  it("200 con credenciales correctas: token con empresaId y sin passwordHash en la respuesta", async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(await stored());
    const res = await request(app).post("/api/auth/login").send({ email: "Admin@A.com", password: "secreto1" });
    expect(res.status).toBe(200);
    expect((jwt.verify(res.body.token, env.jwtSecret) as jwt.JwtPayload).empresaId).toBe("empresa-a");
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });
});

describe("middleware authenticate", () => {
  it("401 sin token", async () => {
    const res = await request(app).get("/api/usuarios/me");
    expect(res.status).toBe(401);
  });

  it("401 con token inválido", async () => {
    const res = await request(app).get("/api/usuarios/me").set("Authorization", "Bearer basura");
    expect(res.status).toBe(401);
  });

  it("401 con token válido pero usuario ya no activo", async () => {
    const token = loginAs(adminA);
    prismaMock.usuario.findFirst.mockReset();
    prismaMock.usuario.findFirst.mockResolvedValue(null);
    const res = await request(app).get("/api/usuarios/me").set("Authorization", token);
    expect(res.status).toBe(401);
  });

  it("200 con token válido", async () => {
    const res = await request(app).get("/api/usuarios/me").set("Authorization", loginAs(adminA));
    expect(res.status).toBe(200);
    expect(res.body.usuario.empresaId).toBe("empresa-a");
  });
});

describe("errores", () => {
  it("ruta inexistente: 404 en JSON", async () => {
    const res = await request(app).get("/api/nada");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Ruta no encontrada/);
  });

  it("error inesperado: 500 sin filtrar detalles internos", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.usuario.findFirst.mockRejectedValue(new Error("fallo de conexión secreto"));
    const res = await request(app).post("/api/auth/login").send({ email: "a@a.com", password: "x" });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Error interno del servidor");
    spy.mockRestore();
  });
});

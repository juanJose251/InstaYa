import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../lib/prisma", async () => ({ default: (await import("./helpers")).prismaMock }));
vi.mock("../config/env", async (importOriginal) => {
  const real = await importOriginal<typeof import("../config/env")>();
  return { env: { ...real.env, platformKey: "clave-del-operador" } };
});

import app from "../app";
import { env } from "../config/env";
import { calcularSuscripcion, extenderSuscripcion, PRECIOS } from "../lib/suscripcion";
import { prismaMock, resetPrismaMock, adminA, loginAs } from "./helpers";

beforeEach(() => resetPrismaMock());

const ahora = new Date("2026-10-28T12:00:00Z");
const dias = (n: number) => new Date(ahora.getTime() + n * 864e5);

describe("calcularSuscripcion (reglas del plan de negocios)", () => {
  it("prueba vigente: estado PRUEBA con los días que faltan", () => {
    const s = calcularSuscripcion({ plan: "PRUEBA", trialFin: dias(10) }, ahora);
    expect(s).toMatchObject({ plan: "PRUEBA", estado: "PRUEBA", diasRestantes: 10, soloLectura: false });
  });

  it("prueba vencida: solo lectura", () => {
    const s = calcularSuscripcion({ plan: "PRUEBA", trialFin: dias(-1) }, ahora);
    expect(s).toMatchObject({ estado: "VENCIDA", diasRestantes: 0, soloLectura: true });
  });

  it("plan Básico pagado: ACTIVA hasta suscripcionFin, aunque la prueba ya haya vencido", () => {
    const s = calcularSuscripcion({ plan: "BASICO", trialFin: dias(-30), suscripcionFin: dias(20) }, ahora);
    expect(s).toMatchObject({ plan: "BASICO", estado: "ACTIVA", diasRestantes: 20, soloLectura: false });
  });

  it("empresa antigua sin fechas: no se le corta el servicio", () => {
    expect(calcularSuscripcion({}, ahora).soloLectura).toBe(false);
  });

  it("extender suma desde el vencimiento si aún no llega, y desde hoy si ya pasó", () => {
    expect(extenderSuscripcion(dias(10), 1, ahora).getTime()).toBeGreaterThan(dias(38).getTime());
    expect(extenderSuscripcion(dias(-10), 1, ahora).getTime()).toBeLessThan(dias(32).getTime());
  });

  it("precios del plan: $50 implementación, $10 al mes, 15 días de prueba", () => {
    expect(PRECIOS).toMatchObject({ implementacion: 50, mensual: 10, diasPrueba: 15 });
  });
});

function loginVencido() {
  prismaMock.usuario.findFirst.mockResolvedValueOnce({
    ...adminA,
    empresa: { activa: true, plan: "PRUEBA", trialFin: new Date(Date.now() - 864e5), suscripcionFin: null },
  });
  return `Bearer ${jwt.sign({ sub: adminA.id, empresaId: adminA.empresaId }, env.jwtSecret)}`;
}

describe("cuenta vencida = solo lectura", () => {
  it("puede leer sus productos (200)", async () => {
    prismaMock.producto.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/productos").set("Authorization", loginVencido());
    expect(res.status).toBe(200);
  });

  it("no puede registrar ventas ni productos (402)", async () => {
    const venta = await request(app).post("/api/ventas").set("Authorization", loginVencido()).send({ total: 5 });
    expect(venta.status).toBe(402);
    const prod = await request(app)
      .post("/api/productos")
      .set("Authorization", loginVencido())
      .send({ nombre: "X", precioCompra: 1, precioVenta: 2 });
    expect(prod.status).toBe(402);
    expect(prismaMock.producto.create).not.toHaveBeenCalled();
  });

  it("sí puede consultar su plan y cómo pagar", async () => {
    const res = await request(app).get("/api/suscripcion").set("Authorization", loginVencido());
    expect(res.status).toBe(200);
    expect(res.body.suscripcion.estado).toBe("VENCIDA");
    expect(res.body.precios.mensual).toBe(10);
  });
});

describe("panel de plataforma (operador del SaaS)", () => {
  it("sin clave o con clave equivocada: 401", async () => {
    expect((await request(app).get("/api/plataforma/empresas")).status).toBe(401);
    const mala = await request(app).get("/api/plataforma/empresas").set("x-platform-key", "otra");
    expect(mala.status).toBe(401);
  });

  it("un JWT de ADMIN de un negocio no sirve para activarse el plan", async () => {
    const res = await request(app)
      .post("/api/plataforma/empresas/empresa-a/activar")
      .set("Authorization", loginAs(adminA))
      .send({ meses: 12 });
    expect(res.status).toBe(401);
    expect(prismaMock.empresa.update).not.toHaveBeenCalled();
  });

  it("activar registra el pago: plan BASICO y vencimiento a N meses", async () => {
    prismaMock.empresa.findFirst.mockResolvedValue({ id: "empresa-a", plan: "PRUEBA", suscripcionFin: null });
    prismaMock.empresa.update.mockImplementation(async ({ data }: { data: object }) => ({ id: "empresa-a", nombre: "A", ...data }));
    const res = await request(app)
      .post("/api/plataforma/empresas/empresa-a/activar")
      .set("x-platform-key", "clave-del-operador")
      .send({ meses: 3 });
    expect(res.status).toBe(200);
    const data = prismaMock.empresa.update.mock.calls[0][0].data;
    expect(data.plan).toBe("BASICO");
    expect(data.suscripcionFin.getTime()).toBeGreaterThan(Date.now() + 88 * 864e5);
    expect(res.body.empresa.suscripcion.estado).toBe("ACTIVA");
  });

  it("activar una empresa que no existe: 404", async () => {
    prismaMock.empresa.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/plataforma/empresas/nada/activar")
      .set("x-platform-key", "clave-del-operador")
      .send({});
    expect(res.status).toBe(404);
  });
});

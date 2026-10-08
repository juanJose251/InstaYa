import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

vi.mock("../lib/prisma", async () => ({ default: (await import("./helpers")).prismaMock }));

import app from "../app";
import { env } from "../config/env";
import { calcularSugerencias, resumenConIA, resumenPorReglas } from "../lib/reposicion";
import { prismaMock, resetPrismaMock, loginAs, adminA } from "./helpers";

beforeEach(() => resetPrismaMock());
afterEach(() => {
  vi.unstubAllGlobals();
  env.anthropicApiKey = "";
});

describe("calcularSugerencias (regla pura)", () => {
  it("sin stock: prioridad máxima y pide cubrir 14 días de ventas", () => {
    // 60 vendidas en 30 días = 2/día -> objetivo 28
    const [s] = calcularSugerencias([{ id: "1", nombre: "Leche", stock: 0, minimo: 5, vendidas: 60 }]);
    expect(s.motivo).toBe("SIN_STOCK");
    expect(s.cantidadSugerida).toBe(28);
    expect(s.diasCobertura).toBe(0);
  });

  it("detecta el producto que se acaba en menos de 7 días aunque supere el mínimo", () => {
    // 3/día, stock 12 -> 4 días de cobertura
    const [s] = calcularSugerencias([{ id: "1", nombre: "Arroz", stock: 12, minimo: 2, vendidas: 90 }]);
    expect(s.motivo).toBe("SE_ACABA_PRONTO");
    expect(s.diasCobertura).toBe(4);
    expect(s.cantidadSugerida).toBe(30); // 42 - 12
  });

  it("bajo el mínimo sin ventas: pide el doble del mínimo", () => {
    const [s] = calcularSugerencias([{ id: "1", nombre: "Sal", stock: 2, minimo: 5, vendidas: 0 }]);
    expect(s.motivo).toBe("BAJO_MINIMO");
    expect(s.diasCobertura).toBeNull();
    expect(s.cantidadSugerida).toBe(8); // 10 - 2
  });

  it("ignora los productos sanos y ordena por urgencia", () => {
    const res = calcularSugerencias([
      { id: "1", nombre: "Sano", stock: 100, minimo: 5, vendidas: 30 },
      { id: "2", nombre: "Bajo", stock: 3, minimo: 5, vendidas: 0 },
      { id: "3", nombre: "Agotado", stock: 0, minimo: 5, vendidas: 0 },
    ]);
    expect(res.map((s) => s.nombre)).toEqual(["Agotado", "Bajo"]);
  });

  it("resumen por reglas cuando todo está bien", () => {
    expect(resumenPorReglas([])).toMatch(/sano/);
  });
});

describe("resumenConIA", () => {
  const sugerencias = calcularSugerencias([{ id: "1", nombre: "Leche", stock: 0, minimo: 5, vendidas: 60 }]);

  it("sin clave de API usa reglas y no llama a la red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await resumenConIA(sugerencias);
    expect(r.fuente).toBe("reglas");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con clave usa la respuesta del modelo", async () => {
    env.anthropicApiKey = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "Repón primero la leche." }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await resumenConIA(sugerencias);
    expect(r).toEqual({ resumen: "Repón primero la leche.", fuente: "ia" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("test-key");
  });

  it("si la API falla, cae al resumen por reglas (nunca rompe el endpoint)", async () => {
    env.anthropicApiKey = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sin red")));
    expect((await resumenConIA(sugerencias)).fuente).toBe("reglas");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect((await resumenConIA(sugerencias)).fuente).toBe("reglas");
  });
});

describe("GET /api/asistente/reposicion", () => {
  it("requiere autenticación", async () => {
    const res = await request(app).get("/api/asistente/reposicion");
    expect(res.status).toBe(401);
  });

  it("devuelve sugerencias y consulta solo mi empresa", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "1", nombre: "Leche", stock: 0, minimo: 5, vendidas: 30 }]);
    const res = await request(app).get("/api/asistente/reposicion").set("Authorization", loginAs(adminA));
    expect(res.status).toBe(200);
    expect(res.body.fuente).toBe("reglas");
    expect(res.body.sugerencias).toHaveLength(1);
    // $queryRaw como tagged template: los valores interpolados van como parámetros (sin inyección SQL)
    const valores = prismaMock.$queryRaw.mock.calls[0].slice(1);
    expect(valores).toContain("empresa-a");
  });
});

describe("reportes y docs", () => {
  it("top-productos parametriza la empresa", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "1", nombre: "Arroz", unidades: 10, ingresos: 35 }]);
    const res = await request(app).get("/api/reportes/top-productos?rango=mes").set("Authorization", loginAs(adminA));
    expect(res.status).toBe(200);
    expect(res.body.productos[0].nombre).toBe("Arroz");
    expect(prismaMock.$queryRaw.mock.calls[0].slice(1)).toContain("empresa-a");
  });

  it("la especificación OpenAPI es pública y describe las rutas nuevas", async () => {
    const res = await request(app).get("/api/docs/openapi.json");
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(["/categorias", "/proveedores", "/asistente/reposicion", "/reportes/top-productos"])
    );
  });
});

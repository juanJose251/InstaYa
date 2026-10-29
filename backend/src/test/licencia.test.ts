import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";

// Llaves de prueba: la tienda real firma con otra llave privada que no está en el repo.
const llaves = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { generateKeyPairSync: gen } = require("node:crypto") as typeof import("node:crypto");
  return gen("ed25519");
});

vi.mock("../lib/prisma", async () => ({ default: (await import("./helpers")).prismaMock }));
vi.mock("../config/env", async (importOriginal) => {
  const real = await importOriginal<typeof import("../config/env")>();
  return { env: { ...real.env, tiendaUrl: "https://tienda.test" } };
});
vi.mock("../lib/licencia", async (importOriginal) => {
  const real = await importOriginal<typeof import("../lib/licencia")>();
  return { ...real, leerLicencia: (clave: string) => real.leerLicencia(clave, llaves.publicKey) };
});

import app from "../app";
import { env } from "../config/env";
import { leerLicencia, LLAVE_PUBLICA } from "../lib/licencia";
import { sincronizarLicencia } from "../routes/licencia";
import { prismaMock, resetPrismaMock, adminA, empleadoA, loginAs } from "./helpers";

function firmar(contenido: object, llave: KeyObject = llaves.privateKey) {
  const datos = Buffer.from(JSON.stringify(contenido));
  return `${datos.toString("base64url")}.${sign(null, datos, llave).toString("base64url")}`;
}
const enDias = (n: number) => new Date(Date.now() + n * 864e5).toISOString();
const licencia = (vence: string) => ({ v: 1, lic: "LIC123", negocio: "Tienda A", email: "a@a.com", vence });

beforeEach(() => resetPrismaMock());
afterEach(() => vi.unstubAllGlobals());

describe("leerLicencia", () => {
  it("acepta una clave bien firmada y devuelve su contenido", () => {
    expect(leerLicencia(firmar(licencia(enDias(30))))).toMatchObject({ lic: "LIC123", negocio: "Tienda A" });
  });

  it("rechaza una clave alterada, de otra llave o mal copiada", () => {
    const buena = firmar(licencia(enDias(30)));
    const [datos, firma] = buena.split(".");
    const alterada = Buffer.from(JSON.stringify(licencia(enDias(3650)))).toString("base64url");
    expect(leerLicencia(`${alterada}.${firma}`)).toBeNull();
    expect(leerLicencia(firmar(licencia(enDias(30)), generateKeyPairSync("ed25519").privateKey))).toBeNull();
    expect(leerLicencia(datos)).toBeNull();
    expect(leerLicencia("basura.total")).toBeNull();
  });

  it("la llave pública de producción carga", () => {
    expect(LLAVE_PUBLICA.asymmetricKeyType).toBe("ed25519");
  });
});

describe("POST /api/licencia", () => {
  it("activa el plan Básico hasta la fecha de la licencia", async () => {
    const vence = enDias(30);
    // prueba vencida (solo lectura): igual se puede activar la licencia
    prismaMock.usuario.findFirst.mockResolvedValueOnce({
      ...adminA,
      empresa: { activa: true, plan: "PRUEBA", trialFin: new Date(Date.now() - 864e5), suscripcionFin: null },
    });
    const token = `Bearer ${jwt.sign({ sub: adminA.id, empresaId: adminA.empresaId }, env.jwtSecret)}`;
    prismaMock.empresa.update.mockResolvedValue({ plan: "BASICO", trialFin: null, suscripcionFin: new Date(vence) });

    const res = await request(app).post("/api/licencia").set("Authorization", token).send({ clave: firmar(licencia(vence)) });

    expect(res.status).toBe(200);
    expect(res.body.suscripcion).toMatchObject({ plan: "BASICO", estado: "ACTIVA", soloLectura: false });
    expect(prismaMock.empresa.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: adminA.empresaId }, data: expect.objectContaining({ plan: "BASICO", suscripcionFin: new Date(vence) }) })
    );
  });

  it("rechaza claves inválidas o vencidas sin tocar la empresa", async () => {
    const invalida = await request(app).post("/api/licencia").set("Authorization", loginAs(adminA)).send({ clave: "x".repeat(40) });
    const vencida = await request(app).post("/api/licencia").set("Authorization", loginAs(adminA)).send({ clave: firmar(licencia(enDias(-1))) });
    expect(invalida.status).toBe(400);
    expect(vencida.status).toBe(400);
    expect(prismaMock.empresa.update).not.toHaveBeenCalled();
  });

  it("un empleado no puede activar licencias", async () => {
    const res = await request(app).post("/api/licencia").set("Authorization", loginAs(empleadoA)).send({ clave: firmar(licencia(enDias(30))) });
    expect(res.status).toBe(403);
  });
});

describe("sincronizarLicencia (renovación automática)", () => {
  it("aplica la clave más nueva que devuelve la tienda", async () => {
    const actual = firmar(licencia(enDias(2)));
    const nueva = firmar(licencia(enDias(32)));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ clave: nueva })));
    vi.stubGlobal("fetch", fetchMock);
    prismaMock.empresa.update.mockResolvedValue({ plan: "BASICO", trialFin: null, suscripcionFin: new Date(enDias(32)) });

    expect(await sincronizarLicencia(adminA.empresaId, actual)).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://tienda.test/.netlify/functions/licencia?lic=LIC123");
    expect(prismaMock.empresa.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ licencia: nueva }) }));
  });

  it("no cambia nada sin internet, si la tienda no tiene algo más nuevo o si la clave es de otra licencia", async () => {
    const actual = firmar(licencia(enDias(10)));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sin internet")));
    expect(await sincronizarLicencia(adminA.empresaId, actual)).toBe(false);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ clave: firmar(licencia(enDias(5))) }))));
    expect(await sincronizarLicencia(adminA.empresaId, actual)).toBe(false);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ clave: firmar({ ...licencia(enDias(60)), lic: "OTRA" }) }))));
    expect(await sincronizarLicencia(adminA.empresaId, actual)).toBe(false);
    expect(prismaMock.empresa.update).not.toHaveBeenCalled();
  });
});

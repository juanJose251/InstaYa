import { describe, it, expect, vi, afterEach } from "vitest";
import { api, ApiError } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("api sin servidor", () => {
  it("cambia el 'Failed to fetch' del navegador por un mensaje que dice qué hacer", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error: unknown = await api.get("/reportes/resumen").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).message).toMatch(/No hay conexión con el servidor/);
  });
});

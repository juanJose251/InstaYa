// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { demoRequest, resetDemoDb, DEMO_EMAIL, DEMO_PASSWORD } from "./demoApi";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const get = (path: string) => demoRequest("GET", path) as Promise<Json>;
const post = (path: string, body: Json) => demoRequest("POST", path, body) as Promise<Json>;

beforeEach(() => {
  localStorage.clear();
  resetDemoDb();
});

describe("demoApi: auth", () => {
  it("acepta la cuenta demo y devuelve token, usuario y empresa", async () => {
    const res = await post("/auth/login", { email: DEMO_EMAIL, password: DEMO_PASSWORD });
    expect(res.token).toBeTruthy();
    expect(res.usuario.rol).toBe("ADMIN");
    expect(res.empresa.nombre).toBeTruthy();
  });

  it("rechaza otras credenciales con 401", async () => {
    await expect(post("/auth/login", { email: "x@x.com", password: "mala" })).rejects.toMatchObject({ status: 401 });
  });

  it("el registro está desactivado (403)", async () => {
    await expect(post("/auth/register", {})).rejects.toMatchObject({ status: 403 });
  });
});

describe("demoApi: productos", () => {
  it("lista productos ordenados por nombre", async () => {
    const { productos } = await get("/productos");
    const nombres = productos.map((p: Json) => p.nombre);
    expect(nombres.length).toBeGreaterThan(5);
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b)));
  });

  it("filtra por texto y por bajo stock", async () => {
    expect((await get("/productos?q=arroz")).productos).toHaveLength(1);
    const bajo = (await get("/productos?bajoStock=true")).productos;
    expect(bajo.length).toBeGreaterThan(0);
    expect(bajo.every((p: Json) => p.stockActual <= p.stockMinimo)).toBe(true);
  });

  it("crea un producto con stock 0 y rechaza SKU repetido (409)", async () => {
    const { producto } = await post("/productos", { nombre: "Café", sku: "CAF-1", precioCompra: 2, precioVenta: 3 });
    expect(producto.stockActual).toBe(0);
    await expect(
      post("/productos", { nombre: "Otro", sku: "CAF-1", precioCompra: 1, precioVenta: 2 })
    ).rejects.toMatchObject({ status: 409 });
  });

  it("valida el nombre (400)", async () => {
    await expect(post("/productos", { nombre: " ", precioCompra: 1, precioVenta: 2 })).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe("demoApi: movimientos", () => {
  it("ENTRADA suma, SALIDA resta y AJUSTE fija el stock", async () => {
    const stock = async () => (await get("/productos?q=arroz")).productos[0].stockActual as number;
    const id = (await get("/productos?q=arroz")).productos[0].id;
    const inicial = await stock();

    await post("/movimientos", { productoId: id, tipo: "ENTRADA", cantidad: 10 });
    expect(await stock()).toBe(inicial + 10);
    await post("/movimientos", { productoId: id, tipo: "SALIDA", cantidad: 4 });
    expect(await stock()).toBe(inicial + 6);
    await post("/movimientos", { productoId: id, tipo: "AJUSTE", cantidad: 3 });
    expect(await stock()).toBe(3);
  });

  it("una SALIDA mayor al stock da 400 y no cambia nada", async () => {
    const p = (await get("/productos?q=leche")).productos[0];
    await expect(post("/movimientos", { productoId: p.id, tipo: "SALIDA", cantidad: p.stockActual + 1 })).rejects.toMatchObject({
      status: 400,
    });
    expect((await get("/productos?q=leche")).productos[0].stockActual).toBe(p.stockActual);
  });

  it("producto inexistente: 404", async () => {
    await expect(post("/movimientos", { productoId: "nada", tipo: "ENTRADA", cantidad: 1 })).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("demoApi: ventas y reportes", () => {
  it("registra una venta y aparece primero en la lista", async () => {
    await post("/ventas", { cliente: "Prueba", total: 5 });
    const { ventas } = await get("/ventas");
    expect(ventas[0]).toMatchObject({ cliente: "Prueba", total: "5.00", status: "COMPLETADA" });
  });

  it("rechaza un total inválido (400)", async () => {
    await expect(post("/ventas", { total: 0 })).rejects.toMatchObject({ status: 400 });
  });

  it("el resumen de 'hoy' suma solo las ventas de hoy y crece al vender", async () => {
    const antes = await get("/reportes/resumen?rango=hoy");
    await post("/ventas", { total: 10 });
    const despues = await get("/reportes/resumen?rango=hoy");
    expect(despues.numeroVentas).toBe(antes.numeroVentas + 1);
    expect(despues.totalVentas).toBeCloseTo(antes.totalVentas + 10);
  });

  it("el rango 'mes' incluye más ventas que 'hoy'", async () => {
    const hoy = await get("/reportes/resumen?rango=hoy");
    const mes = await get("/reportes/resumen?rango=mes");
    expect(mes.numeroVentas).toBeGreaterThan(hoy.numeroVentas);
  });

  it("ruta desconocida: 404", async () => {
    await expect(get("/nada")).rejects.toMatchObject({ status: 404 });
  });
});

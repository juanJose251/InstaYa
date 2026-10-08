// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

describe("demoApi: datos sembrados de hoy", () => {
  afterEach(() => vi.useRealTimers());

  it("a primera hora del día no hay ventas en el futuro y la nueva sale primero", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 4, 3, 0, 0));
    resetDemoDb();
    await post("/ventas", { cliente: "Prueba", total: 5 });
    const { ventas } = await get("/ventas");
    expect(ventas[0]).toMatchObject({ cliente: "Prueba" });
    expect(ventas.every((v: Json) => new Date(v.createdAt).getTime() <= Date.now())).toBe(true);
  });
});

describe("demoApi: categorías y proveedores", () => {
  it("lista con el conteo de productos y rechaza nombres vacíos o repetidos", async () => {
    const { categorias } = await get("/categorias");
    expect(categorias.find((c: Json) => c.nombre === "Granos")._count.productos).toBe(2);
    await expect(post("/categorias", { nombre: " " })).rejects.toMatchObject({ status: 400 });
    await expect(post("/categorias", { nombre: "granos" })).rejects.toMatchObject({ status: 409 });
  });

  it("borrar una categoría deja sus productos sin categoría", async () => {
    const { categoria } = await post("/categorias", { nombre: "Snacks" });
    const { producto } = await post("/productos", { nombre: "Papas", precioCompra: 1, precioVenta: 2, categoriaId: categoria.id });
    expect(producto.categoria.nombre).toBe("Snacks");
    await demoRequest("DELETE", `/categorias/${categoria.id}`);
    const papas = (await get("/productos?q=papas")).productos[0];
    expect(papas.categoriaId).toBeUndefined();
    await expect(demoRequest("DELETE", "/categorias/no-existe")).rejects.toMatchObject({ status: 404 });
  });

  it("valida el correo del proveedor y que el producto use categoría/proveedor existentes", async () => {
    await expect(post("/proveedores", { nombre: "X", email: "malo" })).rejects.toMatchObject({ status: 400 });
    await expect(
      post("/productos", { nombre: "Z", precioCompra: 1, precioVenta: 2, categoriaId: "de-otra-empresa" })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      post("/productos", { nombre: "Z", precioCompra: 1, precioVenta: 2, proveedorId: "de-otra-empresa" })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("demoApi: ventas con productos", () => {
  const arroz = async () => (await get("/productos?q=arroz")).productos[0] as Json;

  it("calcula el total con los precios guardados (ignora el del cliente), descuenta stock y registra la salida", async () => {
    const antes = await arroz();
    const { venta } = await post("/ventas", { items: [{ productoId: antes.id, cantidad: 2 }], total: 999 });
    expect(venta.total).toBe(money(Number(antes.precioVenta) * 2));
    expect((await arroz()).stockActual).toBe(antes.stockActual - 2);
    const { movimientos } = await get("/movimientos");
    expect(movimientos[0]).toMatchObject({ tipo: "SALIDA", cantidad: 2, motivo: "Venta" });
  });

  it("stock insuficiente: 400 y no descuenta nada, ni de los otros productos de la venta", async () => {
    const leche = (await get("/productos?q=leche")).productos[0] as Json;
    const antes = await arroz();
    await expect(
      post("/ventas", {
        items: [
          { productoId: antes.id, cantidad: 1 },
          { productoId: leche.id, cantidad: leche.stockActual + 1 },
        ],
      })
    ).rejects.toMatchObject({ status: 400 });
    expect((await arroz()).stockActual).toBe(antes.stockActual);
  });

  it("anular repone el stock y no se puede anular dos veces (409)", async () => {
    const antes = await arroz();
    const { venta } = await post("/ventas", { items: [{ productoId: antes.id, cantidad: 3 }] });
    await post(`/ventas/${venta.id}/anular`, {});
    expect((await arroz()).stockActual).toBe(antes.stockActual);
    await expect(post(`/ventas/${venta.id}/anular`, {})).rejects.toMatchObject({ status: 409 });
    await expect(post("/ventas/no-existe/anular", {})).rejects.toMatchObject({ status: 404 });
  });

  it("una venta anulada deja de contar en los reportes", async () => {
    const p = await arroz();
    const antes = await get("/reportes/resumen?rango=hoy");
    const { venta } = await post("/ventas", { items: [{ productoId: p.id, cantidad: 1 }] });
    await post(`/ventas/${venta.id}/anular`, {});
    const despues = await get("/reportes/resumen?rango=hoy");
    expect(despues.numeroVentas).toBe(antes.numeroVentas);
  });
});

describe("demoApi: top de productos y asistente de reposición", () => {
  it("top-productos viene ordenado por unidades y limitado a 5", async () => {
    const { productos } = await get("/reportes/top-productos?rango=mes");
    expect(productos.length).toBeGreaterThan(0);
    expect(productos.length).toBeLessThanOrEqual(5);
    const unidades = productos.map((p: Json) => p.unidades);
    expect(unidades).toEqual([...unidades].sort((a, b) => b - a));
  });

  it("sugiere reponer lo que está bajo el mínimo y deja de sugerirlo tras una entrada", async () => {
    const antes = await get("/asistente/reposicion");
    expect(antes.fuente).toBe("reglas");
    const leche = antes.sugerencias.find((s: Json) => s.nombre === "Leche 1 L");
    expect(leche.cantidadSugerida).toBeGreaterThan(0);

    await post("/movimientos", { productoId: leche.productoId, tipo: "ENTRADA", cantidad: 200 });
    const despues = await get("/asistente/reposicion");
    expect(despues.sugerencias.find((s: Json) => s.nombre === "Leche 1 L")).toBeUndefined();
  });
});

function money(n: number) {
  return n.toFixed(2);
}

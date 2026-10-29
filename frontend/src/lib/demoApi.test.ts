// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { demoRequest, resetDemoDb, DEMO_EMAIL, DEMO_PASSWORD } from "./demoApi";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const get = (path: string) => demoRequest("GET", path) as Promise<Json>;
const post = (path: string, body: Json) => demoRequest("POST", path, body) as Promise<Json>;

beforeEach(() => {
  localStorage.clear();
  resetDemoDb();
  localStorage.setItem("instaya_token", "demo-token"); // sesión de la dueña (ADMIN)
});

const put = (path: string, body: Json) => demoRequest("PUT", path, body) as Promise<Json>;
const del = (path: string) => demoRequest("DELETE", path) as Promise<Json>;

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

describe("demoApi: sesión y roles", () => {
  it("sin sesión responde 401, igual que el backend", async () => {
    localStorage.removeItem("instaya_token");
    await expect(get("/productos")).rejects.toMatchObject({ status: 401 });
  });

  it("/usuarios/me devuelve la empresa y el estado del plan", async () => {
    const me = await get("/usuarios/me");
    expect(me.empresa.nombre).toContain("demo");
    expect(me.suscripcion.estado).toBe("PRUEBA");
    expect(me.suscripcion.diasRestantes).toBeGreaterThan(0);
  });

  it("un EMPLEADO entra con su cuenta, puede vender pero no crear productos (403)", async () => {
    const login = await post("/auth/login", { email: "cajero@instaya.app", password: "cajero123" });
    localStorage.setItem("instaya_token", login.token);
    expect(login.usuario.rol).toBe("EMPLEADO");
    await expect(post("/productos", { nombre: "X", precioCompra: 1, precioVenta: 2 })).rejects.toMatchObject({ status: 403 });
    const venta = await post("/ventas", { items: [{ productoId: "demo-prod-1", cantidad: 1 }] });
    expect(venta.venta.total).toBe("3.50");
  });
});

describe("demoApi: editar y eliminar productos", () => {
  it("edita precio y mínimo; un SKU de otro producto da 409", async () => {
    const { producto } = await put("/productos/demo-prod-1", { precioVenta: 3.75, stockMinimo: 12 });
    expect(producto).toMatchObject({ precioVenta: "3.75", stockMinimo: 12 });
    await expect(put("/productos/demo-prod-1", { sku: "FRJ-1LB" })).rejects.toMatchObject({ status: 409 });
  });

  it("eliminar es baja lógica: desaparece de la lista y de los reportes, pero sus ventas siguen", async () => {
    const antes = (await get("/reportes/resumen?rango=mes")).totalProductos;
    await del("/productos/demo-prod-8");
    const { productos } = await get("/productos");
    expect(productos.some((p: Json) => p.id === "demo-prod-8")).toBe(false);
    expect((await get("/reportes/resumen?rango=mes")).totalProductos).toBe(antes - 1);
    const { ventas } = await get("/ventas");
    expect(ventas.some((v: Json) => v.items.some((it: Json) => it.productoId === "demo-prod-8"))).toBe(true);
    await expect(post("/ventas", { items: [{ productoId: "demo-prod-8", cantidad: 1 }] })).rejects.toMatchObject({ status: 404 });
  });
});

describe("demoApi: importación masiva", () => {
  it("crea productos nuevos con categoría nueva y actualiza por SKU sin duplicar", async () => {
    const res = await post("/productos/importar", {
      productos: [
        { nombre: "Café 400 g", sku: "CAF-400", categoria: "Bebidas calientes", precioCompra: 3, precioVenta: 4.5, stock: 12 },
        { nombre: "Arroz 5 lb", sku: "arz-5lb", precioCompra: 2.7, precioVenta: 3.6, stock: 50 },
      ],
    });
    expect(res).toEqual({ creados: 1, actualizados: 1, categoriasCreadas: 1, proveedoresCreados: 0 });
    const { productos } = await get("/productos?q=arroz");
    expect(productos).toHaveLength(1);
    expect(productos[0]).toMatchObject({ precioVenta: "3.60", stockActual: 50 });
    const { movimientos } = await get("/movimientos");
    expect(movimientos.filter((m: Json) => m.motivo?.includes("mport"))).toHaveLength(2);
  });

  it("todo o nada: una fila mala no guarda ninguna y devuelve el detalle", async () => {
    const antes = (await get("/productos")).productos.length;
    await expect(
      post("/productos/importar", { productos: [{ nombre: "Ok", precioCompra: 1, precioVenta: 2 }, { nombre: "", precioCompra: 1, precioVenta: 2 }] })
    ).rejects.toMatchObject({ status: 400, data: { errores: [{ fila: 3, error: "Nombre requerido" }] } });
    expect((await get("/productos")).productos.length).toBe(antes);
  });
});

describe("demoApi: equipo, empresa y plan", () => {
  it("crea un empleado y no deja que la dueña se desactive a sí misma", async () => {
    const { usuario } = await post("/usuarios", { nombre: "Ana", email: "ana@tienda.com", password: "secreto1" });
    expect(usuario).toMatchObject({ rol: "EMPLEADO", activo: true });
    expect(usuario.password).toBeUndefined();
    await expect(post("/usuarios", { nombre: "Ana 2", email: "ANA@tienda.com", password: "secreto1" })).rejects.toMatchObject({ status: 409 });
    await expect(put("/usuarios/demo-user", { activo: false })).rejects.toMatchObject({ status: 400 });
    const off = await put(`/usuarios/${usuario.id}`, { activo: false });
    expect(off.usuario.activo).toBe(false);
    await expect(post("/auth/login", { email: "ana@tienda.com", password: "secreto1" })).rejects.toMatchObject({ status: 403 });
  });

  it("edita los datos de la empresa", async () => {
    const { empresa } = await put("/empresa", { nombre: "Tienda Nueva", telefono: "7777-0000" });
    expect(empresa).toMatchObject({ nombre: "Tienda Nueva", telefono: "7777-0000" });
  });

  it("plan vencido = solo lectura (402); al pagar vuelve a registrar", async () => {
    await post("/suscripcion/demo/vencer", {});
    expect((await get("/suscripcion")).suscripcion.estado).toBe("VENCIDA");
    await expect(post("/ventas", { total: 5 })).rejects.toMatchObject({ status: 402 });
    expect((await get("/productos")).productos.length).toBeGreaterThan(0); // puede seguir viendo

    const pago = await post("/suscripcion/demo/pagar", { meses: 1 });
    expect(pago.suscripcion).toMatchObject({ plan: "BASICO", estado: "ACTIVA" });
    expect((await post("/ventas", { total: 5 })).venta.total).toBe("5.00");
  });

  it("precios del plan de negocios", async () => {
    const { precios } = await get("/suscripcion");
    expect(precios).toMatchObject({ implementacion: 50, mensual: 10, diasPrueba: 15 });
  });
});


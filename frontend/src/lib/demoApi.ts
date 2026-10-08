/**
 * API simulada para la demo pública (VITE_DEMO=true).
 *
 * Replica los endpoints del backend real (mismos paths, mismas formas de respuesta
 * y mismas reglas: stock suficiente, anulación que repone stock, etc.) guardando todo
 * en localStorage. Así la demo funciona sin servidor ni base de datos.
 */
import { calcularSugerencias, resumenPorReglas, VENTANA_DIAS } from "./reposicion";

interface DemoCategoria {
  id: string;
  nombre: string;
  descripcion?: string;
}

interface DemoProveedor {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
}

interface DemoProducto {
  id: string;
  nombre: string;
  sku?: string;
  categoriaId?: string;
  proveedorId?: string;
  precioCompra: string;
  precioVenta: string;
  stockActual: number;
  stockMinimo: number;
}

interface DemoMovimiento {
  id: string;
  productoId: string;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE";
  cantidad: number;
  motivo?: string;
  createdAt: string;
  producto: { nombre: string };
  creadoPor: { nombre: string };
}

interface DemoVentaItem {
  productoId: string;
  cantidad: number;
  precioUnit: string;
  subtotal: string;
}

interface DemoVenta {
  id: string;
  cliente?: string;
  total: string;
  status: "COMPLETADA" | "ANULADA";
  createdAt: string;
  items: DemoVentaItem[];
}

interface DemoDb {
  categorias: DemoCategoria[];
  proveedores: DemoProveedor[];
  productos: DemoProducto[];
  movimientos: DemoMovimiento[];
  ventas: DemoVenta[];
}

export const DEMO_EMAIL = "demo@instaya.app";
export const DEMO_PASSWORD = "demo1234";

// v2: la forma de los datos cambió (categorías, proveedores, ventas con items)
const DB_KEY = "instaya_demo_db_v2";
const DEMO_USER = { id: "demo-user", nombre: "Dueña Demo", email: DEMO_EMAIL, rol: "ADMIN" as const };
const DEMO_EMPRESA = { id: "demo-empresa", nombre: "Abarrotería La Esperanza (demo)" };

export class DemoError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const money = (n: number) => n.toFixed(2);
const newId = () => crypto.randomUUID();
const daysAgo = (d: number, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() - d);
  date.setHours(hour, 0, 0, 0);
  // los datos sembrados de hoy nunca deben quedar en el futuro (p. ej. si se abre la demo a las 3:00)
  const now = Date.now();
  if (date.getTime() > now) return new Date(now - (hour + 1) * 60_000).toISOString();
  return date.toISOString();
};

export function buildDemoDb(): DemoDb {
  const categorias: DemoCategoria[] = ["Granos", "Abarrotes", "Lácteos", "Limpieza", "Bebidas"].map((nombre, i) => ({
    id: `demo-cat-${i + 1}`,
    nombre,
  }));
  const proveedores: DemoProveedor[] = [
    { id: "demo-prov-1", nombre: "Distribuidora Central", telefono: "2222-1111" },
    { id: "demo-prov-2", nombre: "Lácteos El Pastor", telefono: "2222-2222" },
    { id: "demo-prov-3", nombre: "Embotelladora Nacional", telefono: "2222-3333" },
  ];

  // [nombre, sku, categoría, proveedor, compra, venta, stock, mínimo]
  const seed: [string, string, number, number, number, number, number, number][] = [
    ["Arroz 5 lb", "ARZ-5LB", 1, 1, 2.6, 3.5, 40, 10],
    ["Frijoles rojos 1 lb", "FRJ-1LB", 1, 1, 0.7, 1.1, 60, 15],
    ["Aceite 900 ml", "ACE-900", 2, 1, 2.4, 3.25, 8, 10],
    ["Azúcar 2 lb", "AZU-2LB", 2, 1, 1.0, 1.6, 35, 10],
    ["Leche 1 L", "LEC-1L", 3, 2, 0.9, 1.35, 4, 12],
    ["Huevos (docena)", "HUE-12", 3, 2, 2.2, 3.0, 20, 6],
    ["Detergente 1 kg", "DET-1KG", 4, 1, 2.7, 3.75, 15, 5],
    ["Agua 1 L", "AGU-1L", 5, 3, 0.5, 0.8, 90, 20],
  ];
  const productos: DemoProducto[] = seed.map(([nombre, sku, cat, prov, compra, venta, stock, min], i) => ({
    id: `demo-prod-${i + 1}`,
    nombre,
    sku,
    categoriaId: `demo-cat-${cat}`,
    proveedorId: `demo-prov-${prov}`,
    precioCompra: money(compra),
    precioVenta: money(venta),
    stockActual: stock,
    stockMinimo: min,
  }));

  // [días atrás, cliente, [[producto #, cantidad], ...]]
  const ventasSeed: [number, string | undefined, [number, number][]][] = [
    [0, "Doña Marta", [[1, 2], [8, 3], [6, 1]]],
    [0, undefined, [[5, 2], [2, 4]]],
    [1, "Tienda Don Beto", [[1, 4], [4, 5]]],
    [2, undefined, [[5, 3], [3, 6]]],
    [3, "Cliente mayorista", [[8, 12], [2, 10]]],
    [5, undefined, [[7, 2], [5, 2]]],
    [8, undefined, [[1, 3], [8, 6]]],
    [12, undefined, [[5, 6], [4, 2], [3, 5]]],
    [15, "Tienda Don Beto", [[2, 12], [1, 8]]],
    [20, undefined, [[5, 8], [6, 3], [3, 4]]],
    [24, undefined, [[8, 10], [7, 1]]],
  ];
  const ventas: DemoVenta[] = ventasSeed.map(([d, cliente, lineas], i) => {
    const items = lineas.map(([n, cantidad]) => {
      const precio = Number(productos[n - 1].precioVenta);
      return { productoId: `demo-prod-${n}`, cantidad, precioUnit: money(precio), subtotal: money(precio * cantidad) };
    });
    return {
      id: `demo-venta-${i + 1}`,
      cliente,
      total: money(items.reduce((s, it) => s + Number(it.subtotal), 0)),
      status: "COMPLETADA" as const,
      createdAt: daysAgo(d, 9 + (i % 8)),
      items,
    };
  });

  const movimientos: DemoMovimiento[] = [
    ["demo-prod-1", "ENTRADA", 50, "Compra a proveedor", 6],
    ["demo-prod-5", "SALIDA", 6, "Venta", 1],
    ["demo-prod-3", "AJUSTE", 8, "Conteo físico", 2],
    ["demo-prod-2", "ENTRADA", 30, "Compra a proveedor", 4],
  ].map(([productoId, tipo, cantidad, motivo, d], i) => ({
    id: `demo-mov-${i + 1}`,
    productoId: productoId as string,
    tipo: tipo as DemoMovimiento["tipo"],
    cantidad: cantidad as number,
    motivo: motivo as string,
    createdAt: daysAgo(d as number),
    producto: { nombre: productos.find((p) => p.id === productoId)!.nombre },
    creadoPor: { nombre: DEMO_USER.nombre },
  }));

  return { categorias, proveedores, productos, movimientos, ventas };
}

function loadDb(): DemoDb {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as DemoDb;
  } catch {
    // datos corruptos o localStorage bloqueado: se vuelve a sembrar
  }
  const db = buildDemoDb();
  saveDb(db);
  return db;
}

function saveDb(db: DemoDb) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // sin localStorage la demo sigue funcionando hasta recargar
  }
}

export function resetDemoDb() {
  saveDb(buildDemoDb());
}

function rangeStart(rango: string): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (rango === "semana") d.setDate(d.getDate() - 6);
  else if (rango === "mes") d.setDate(d.getDate() - 29);
  return d;
}

type Body = Record<string, unknown>;

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Productos con los nombres de su categoría y proveedor, como los devuelve el backend. */
function conRelaciones(db: DemoDb, p: DemoProducto) {
  return {
    ...p,
    categoria: p.categoriaId ? { nombre: db.categorias.find((c) => c.id === p.categoriaId)?.nombre } : null,
    proveedor: p.proveedorId ? { nombre: db.proveedores.find((c) => c.id === p.proveedorId)?.nombre } : null,
  };
}

/** Equivalente a `request()` de api.ts, pero contra la "BD" local. */
export async function demoRequest(method: string, path: string, body?: Body): Promise<unknown> {
  const [pathname, queryString = ""] = path.split("?");
  const query = new URLSearchParams(queryString);
  const db = loadDb();

  // --- Auth ---
  if (method === "POST" && pathname === "/auth/login") {
    if (body?.email !== DEMO_EMAIL || body?.password !== DEMO_PASSWORD) {
      throw new DemoError(401, `Demo: usa ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    }
    return { token: "demo-token", usuario: DEMO_USER, empresa: DEMO_EMPRESA };
  }
  if (method === "POST" && pathname === "/auth/register") {
    throw new DemoError(403, "El registro está desactivado en la demo. Entra con la cuenta demo.");
  }
  if (method === "GET" && pathname === "/usuarios/me") {
    return { usuario: DEMO_USER };
  }

  // --- Categorías y proveedores ---
  if (pathname === "/categorias" && method === "GET") {
    const categorias = [...db.categorias]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((c) => ({ ...c, _count: { productos: db.productos.filter((p) => p.categoriaId === c.id).length } }));
    return { categorias };
  }
  if (pathname === "/categorias" && method === "POST") {
    const nombre = text(body?.nombre);
    if (!nombre) throw new DemoError(400, "Nombre requerido");
    if (db.categorias.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) {
      throw new DemoError(409, "Ya existe un registro con ese valor único (por ejemplo, el SKU)");
    }
    const categoria: DemoCategoria = { id: newId(), nombre, descripcion: text(body?.descripcion) };
    db.categorias.push(categoria);
    saveDb(db);
    return { categoria };
  }
  const catId = pathname.match(/^\/categorias\/([^/]+)$/)?.[1];
  if (catId && method === "DELETE") {
    if (!db.categorias.some((c) => c.id === catId)) throw new DemoError(404, "Categoría no encontrada");
    db.categorias = db.categorias.filter((c) => c.id !== catId);
    db.productos.forEach((p) => {
      if (p.categoriaId === catId) p.categoriaId = undefined; // onDelete: SetNull
    });
    saveDb(db);
    return {};
  }

  if (pathname === "/proveedores" && method === "GET") {
    const proveedores = [...db.proveedores]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((c) => ({ ...c, _count: { productos: db.productos.filter((p) => p.proveedorId === c.id).length } }));
    return { proveedores };
  }
  if (pathname === "/proveedores" && method === "POST") {
    const nombre = text(body?.nombre);
    if (!nombre) throw new DemoError(400, "Nombre requerido");
    const email = text(body?.email);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new DemoError(400, "Correo inválido");
    if (db.proveedores.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) {
      throw new DemoError(409, "Ya existe un registro con ese valor único (por ejemplo, el SKU)");
    }
    const proveedor: DemoProveedor = { id: newId(), nombre, telefono: text(body?.telefono), email, direccion: text(body?.direccion) };
    db.proveedores.push(proveedor);
    saveDb(db);
    return { proveedor };
  }
  const provId = pathname.match(/^\/proveedores\/([^/]+)$/)?.[1];
  if (provId && method === "DELETE") {
    if (!db.proveedores.some((c) => c.id === provId)) throw new DemoError(404, "Proveedor no encontrado");
    db.proveedores = db.proveedores.filter((c) => c.id !== provId);
    db.productos.forEach((p) => {
      if (p.proveedorId === provId) p.proveedorId = undefined;
    });
    saveDb(db);
    return {};
  }

  // --- Productos ---
  if (pathname === "/productos" && method === "GET") {
    const q = (query.get("q") ?? "").toLowerCase();
    let productos = db.productos.filter(
      (p) => !q || p.nombre.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    );
    if (query.get("bajoStock") === "true") productos = productos.filter((p) => p.stockActual <= p.stockMinimo);
    return {
      productos: [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((p) => conRelaciones(db, p)),
    };
  }
  if (pathname === "/productos" && method === "POST") {
    const nombre = String(body?.nombre ?? "").trim();
    if (!nombre) throw new DemoError(400, "Nombre requerido");
    const compra = Number(body?.precioCompra);
    const venta = Number(body?.precioVenta);
    if (!(compra >= 0)) throw new DemoError(400, "Precio de compra inválido");
    if (!(venta >= 0)) throw new DemoError(400, "Precio de venta inválido");
    const sku = body?.sku ? String(body.sku) : undefined;
    if (sku && db.productos.some((p) => p.sku === sku)) {
      throw new DemoError(409, "Ya existe un registro con ese valor único (por ejemplo, el SKU)");
    }
    const categoriaId = text(body?.categoriaId);
    if (categoriaId && !db.categorias.some((c) => c.id === categoriaId)) throw new DemoError(400, "Categoría no válida");
    const proveedorId = text(body?.proveedorId);
    if (proveedorId && !db.proveedores.some((c) => c.id === proveedorId)) throw new DemoError(400, "Proveedor no válido");
    const producto: DemoProducto = {
      id: newId(),
      nombre,
      sku,
      categoriaId,
      proveedorId,
      precioCompra: money(compra),
      precioVenta: money(venta),
      stockActual: 0,
      stockMinimo: Number(body?.stockMinimo ?? 0),
    };
    db.productos.push(producto);
    saveDb(db);
    return { producto: conRelaciones(db, producto) };
  }

  // --- Movimientos ---
  if (pathname === "/movimientos" && method === "GET") {
    return { movimientos: [...db.movimientos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  }
  if (pathname === "/movimientos" && method === "POST") {
    const tipo = body?.tipo as DemoMovimiento["tipo"];
    const cantidad = Number(body?.cantidad);
    if (!["ENTRADA", "SALIDA", "AJUSTE"].includes(tipo)) throw new DemoError(400, "Tipo inválido");
    if (!Number.isInteger(cantidad) || cantidad < 0) throw new DemoError(400, "Cantidad inválida");
    if (tipo !== "AJUSTE" && cantidad < 1) throw new DemoError(400, "La cantidad debe ser mayor a 0");
    const producto = db.productos.find((p) => p.id === body?.productoId);
    if (!producto) throw new DemoError(404, "Producto no encontrado");

    const nuevoStock =
      tipo === "ENTRADA" ? producto.stockActual + cantidad : tipo === "SALIDA" ? producto.stockActual - cantidad : cantidad;
    if (nuevoStock < 0) throw new DemoError(400, "Stock insuficiente para esta salida");

    producto.stockActual = nuevoStock;
    const movimiento: DemoMovimiento = {
      id: newId(),
      productoId: producto.id,
      tipo,
      cantidad,
      motivo: body?.motivo ? String(body.motivo) : undefined,
      createdAt: new Date().toISOString(),
      producto: { nombre: producto.nombre },
      creadoPor: { nombre: DEMO_USER.nombre },
    };
    db.movimientos.push(movimiento);
    saveDb(db);
    return { movimiento };
  }

  // --- Ventas ---
  if (pathname === "/ventas" && method === "GET") {
    const ventas = [...db.ventas]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((v) => ({
        ...v,
        items: v.items.map((it) => ({ ...it, producto: { nombre: db.productos.find((p) => p.id === it.productoId)?.nombre ?? "" } })),
      }));
    return { ventas };
  }
  if (pathname === "/ventas" && method === "POST") {
    const cliente = text(body?.cliente);
    const entrada = body?.items as { productoId: string; cantidad: number }[] | undefined;

    // Venta rápida: total manual, sin descontar stock
    if (!entrada) {
      const total = Number(body?.total);
      if (!(total > 0)) throw new DemoError(400, "Total inválido");
      const venta: DemoVenta = { id: newId(), cliente, total: money(total), status: "COMPLETADA", createdAt: new Date().toISOString(), items: [] };
      db.ventas.push(venta);
      saveDb(db);
      return { venta };
    }

    // Venta con productos: el total sale de los precios guardados, nunca del cliente.
    // Se valida todo antes de tocar el stock (equivale a la transacción del backend).
    if (!Array.isArray(entrada) || entrada.length === 0) throw new DemoError(400, "Indica el total o los productos vendidos");
    const pedido = new Map<string, number>();
    for (const it of entrada) {
      if (!Number.isInteger(it.cantidad) || it.cantidad < 1) throw new DemoError(400, "Cantidad inválida");
      pedido.set(it.productoId, (pedido.get(it.productoId) ?? 0) + it.cantidad);
    }
    const items: DemoVentaItem[] = [];
    for (const [productoId, cantidad] of pedido) {
      const producto = db.productos.find((p) => p.id === productoId);
      if (!producto) throw new DemoError(404, "Producto no encontrado");
      if (producto.stockActual < cantidad) {
        throw new DemoError(400, `Stock insuficiente de "${producto.nombre}" (disponible: ${producto.stockActual})`);
      }
      items.push({ productoId, cantidad, precioUnit: producto.precioVenta, subtotal: money(Number(producto.precioVenta) * cantidad) });
    }
    const creadoEn = new Date().toISOString();
    for (const it of items) {
      const producto = db.productos.find((p) => p.id === it.productoId)!;
      producto.stockActual -= it.cantidad;
      db.movimientos.push({
        id: newId(),
        productoId: producto.id,
        tipo: "SALIDA",
        cantidad: it.cantidad,
        motivo: "Venta",
        createdAt: creadoEn,
        producto: { nombre: producto.nombre },
        creadoPor: { nombre: DEMO_USER.nombre },
      });
    }
    const venta: DemoVenta = {
      id: newId(),
      cliente,
      total: money(items.reduce((s, it) => s + Number(it.subtotal), 0)),
      status: "COMPLETADA",
      createdAt: creadoEn,
      items,
    };
    db.ventas.push(venta);
    saveDb(db);
    return { venta };
  }
  const anularId = pathname.match(/^\/ventas\/([^/]+)\/anular$/)?.[1];
  if (anularId && method === "POST") {
    const venta = db.ventas.find((v) => v.id === anularId);
    if (!venta) throw new DemoError(404, "Venta no encontrada");
    if (venta.status === "ANULADA") throw new DemoError(409, "La venta ya está anulada");
    for (const it of venta.items) {
      const producto = db.productos.find((p) => p.id === it.productoId);
      if (!producto) continue;
      producto.stockActual += it.cantidad;
      db.movimientos.push({
        id: newId(),
        productoId: producto.id,
        tipo: "ENTRADA",
        cantidad: it.cantidad,
        motivo: "Anulación de venta",
        createdAt: new Date().toISOString(),
        producto: { nombre: producto.nombre },
        creadoPor: { nombre: DEMO_USER.nombre },
      });
    }
    venta.status = "ANULADA";
    saveDb(db);
    return { venta };
  }

  // --- Reportes ---
  if (pathname === "/reportes/resumen" && method === "GET") {
    const rango = query.get("rango") ?? "hoy";
    const desde = rangeStart(rango).toISOString();
    const ventas = db.ventas.filter((v) => v.status === "COMPLETADA" && v.createdAt >= desde);
    return {
      rango,
      totalProductos: db.productos.length,
      stockBajo: db.productos.filter((p) => p.stockActual <= p.stockMinimo).length,
      valorInventario: db.productos.reduce((s, p) => s + Number(p.precioCompra) * p.stockActual, 0),
      numeroVentas: ventas.length,
      totalVentas: ventas.reduce((s, v) => s + Number(v.total), 0),
      numeroMovimientos: db.movimientos.filter((m) => m.createdAt >= desde).length,
    };
  }
  if (pathname === "/reportes/top-productos" && method === "GET") {
    const rango = query.get("rango") ?? "mes";
    const desde = rangeStart(rango).toISOString();
    const acumulado = new Map<string, { unidades: number; ingresos: number }>();
    for (const v of db.ventas) {
      if (v.status !== "COMPLETADA" || v.createdAt < desde) continue;
      for (const it of v.items) {
        const a = acumulado.get(it.productoId) ?? { unidades: 0, ingresos: 0 };
        a.unidades += it.cantidad;
        a.ingresos += Number(it.subtotal);
        acumulado.set(it.productoId, a);
      }
    }
    const productos = [...acumulado]
      .map(([id, a]) => ({ id, nombre: db.productos.find((p) => p.id === id)?.nombre ?? "", ...a }))
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 5);
    return { rango, productos };
  }

  // --- Asistente de reposición (en la demo solo reglas: no hay clave de API en el navegador) ---
  if (pathname === "/asistente/reposicion" && method === "GET") {
    const desde = new Date(Date.now() - VENTANA_DIAS * 24 * 60 * 60 * 1000).toISOString();
    const vendidas = new Map<string, number>();
    for (const v of db.ventas) {
      if (v.status !== "COMPLETADA" || v.createdAt < desde) continue;
      for (const it of v.items) vendidas.set(it.productoId, (vendidas.get(it.productoId) ?? 0) + it.cantidad);
    }
    const sugerencias = calcularSugerencias(
      db.productos.map((p) => ({ id: p.id, nombre: p.nombre, stock: p.stockActual, minimo: p.stockMinimo, vendidas: vendidas.get(p.id) ?? 0 }))
    );
    return { resumen: resumenPorReglas(sugerencias), fuente: "reglas", sugerencias };
  }

  throw new DemoError(404, `Ruta no encontrada: ${method} ${path}`);
}

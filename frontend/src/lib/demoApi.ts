/**
 * API simulada para la demo pública (VITE_DEMO=true).
 *
 * Replica los endpoints del backend real (mismos paths, mismas formas de respuesta
 * y mismas reglas: stock suficiente, anulación que repone stock, etc.) guardando todo
 * en localStorage. Así la demo funciona sin servidor ni base de datos.
 */

interface DemoProducto {
  id: string;
  nombre: string;
  sku?: string;
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

interface DemoVenta {
  id: string;
  cliente?: string;
  total: string;
  status: "COMPLETADA" | "ANULADA";
  createdAt: string;
}

interface DemoDb {
  productos: DemoProducto[];
  movimientos: DemoMovimiento[];
  ventas: DemoVenta[];
}

export const DEMO_EMAIL = "demo@instaya.app";
export const DEMO_PASSWORD = "demo1234";

const DB_KEY = "instaya_demo_db";
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
  const seed: [string, string, number, number, number, number][] = [
    ["Arroz 5 lb", "ARZ-5LB", 2.6, 3.5, 40, 10],
    ["Frijoles rojos 1 lb", "FRJ-1LB", 0.7, 1.1, 60, 15],
    ["Aceite 900 ml", "ACE-900", 2.4, 3.25, 8, 10],
    ["Azúcar 2 lb", "AZU-2LB", 1.0, 1.6, 35, 10],
    ["Leche 1 L", "LEC-1L", 0.9, 1.35, 4, 12],
    ["Huevos (docena)", "HUE-12", 2.2, 3.0, 20, 6],
    ["Detergente 1 kg", "DET-1KG", 2.7, 3.75, 15, 5],
    ["Agua 1 L", "AGU-1L", 0.5, 0.8, 90, 20],
  ];
  const productos: DemoProducto[] = seed.map(([nombre, sku, compra, venta, stock, min], i) => ({
    id: `demo-prod-${i + 1}`,
    nombre,
    sku,
    precioCompra: money(compra),
    precioVenta: money(venta),
    stockActual: stock,
    stockMinimo: min,
  }));

  const ventasSeed: [number, number, string?][] = [
    [0, 12.5, "Doña Marta"],
    [0, 4.6],
    [1, 18.2, "Tienda Don Beto"],
    [2, 7.35],
    [3, 22.1, "Cliente mayorista"],
    [5, 9.8],
    [8, 15.4],
    [15, 31.0, "Tienda Don Beto"],
    [24, 11.25],
  ];
  const ventas: DemoVenta[] = ventasSeed.map(([d, total, cliente], i) => ({
    id: `demo-venta-${i + 1}`,
    cliente,
    total: money(total),
    status: "COMPLETADA",
    createdAt: daysAgo(d, 9 + (i % 8)),
  }));

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

  return { productos, movimientos, ventas };
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

  // --- Productos ---
  if (pathname === "/productos" && method === "GET") {
    const q = (query.get("q") ?? "").toLowerCase();
    let productos = db.productos.filter(
      (p) => !q || p.nombre.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    );
    if (query.get("bajoStock") === "true") productos = productos.filter((p) => p.stockActual <= p.stockMinimo);
    return { productos: [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre)) };
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
    const producto: DemoProducto = {
      id: newId(),
      nombre,
      sku,
      precioCompra: money(compra),
      precioVenta: money(venta),
      stockActual: 0,
      stockMinimo: Number(body?.stockMinimo ?? 0),
    };
    db.productos.push(producto);
    saveDb(db);
    return { producto };
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
    return { ventas: [...db.ventas].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  }
  if (pathname === "/ventas" && method === "POST") {
    const total = Number(body?.total);
    if (!(total > 0)) throw new DemoError(400, "Total inválido");
    const venta: DemoVenta = {
      id: newId(),
      cliente: body?.cliente ? String(body.cliente) : undefined,
      total: money(total),
      status: "COMPLETADA",
      createdAt: new Date().toISOString(),
    };
    db.ventas.push(venta);
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

  throw new DemoError(404, `Ruta no encontrada: ${method} ${path}`);
}

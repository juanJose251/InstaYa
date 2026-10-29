/**
 * De una hoja de cálculo (Excel o CSV) a filas de productos listas para `POST /productos/importar`.
 * Acepta encabezados en español con o sin tildes y en cualquier orden, porque cada negocio
 * llega con "su" Excel: lo importante es reconocer las columnas, no exigir un formato rígido.
 */
import type { Celda } from "./xlsx";

export interface FilaProducto {
  nombre: string;
  sku?: string;
  categoria?: string;
  proveedor?: string;
  precioCompra: number;
  precioVenta: number;
  stock?: number;
  stockMinimo?: number;
}

export interface FilaRevisada {
  fila: number; // número de fila en la hoja (1 = encabezados)
  datos?: FilaProducto;
  error?: string;
}

/** Columnas que entiende la plantilla y los nombres alternativos que se aceptan. */
export const COLUMNAS: { campo: keyof FilaProducto; titulo: string; alias: string[] }[] = [
  { campo: "nombre", titulo: "Nombre", alias: ["nombre", "producto", "descripcion", "articulo", "nombre del producto"] },
  { campo: "sku", titulo: "SKU", alias: ["sku", "codigo", "cod", "codigo de barras", "referencia", "ref"] },
  { campo: "categoria", titulo: "Categoría", alias: ["categoria", "rubro", "familia", "linea", "departamento"] },
  { campo: "proveedor", titulo: "Proveedor", alias: ["proveedor", "distribuidor", "marca proveedor"] },
  { campo: "precioCompra", titulo: "Precio compra", alias: ["precio compra", "costo", "precio de compra", "precio costo", "precio de costo", "costo unitario", "compra"] },
  { campo: "precioVenta", titulo: "Precio venta", alias: ["precio venta", "precio", "precio de venta", "pvp", "venta"] },
  { campo: "stock", titulo: "Stock", alias: ["stock", "existencia", "existencias", "cantidad", "inventario", "stock actual"] },
  { campo: "stockMinimo", titulo: "Stock mínimo", alias: ["stock minimo", "minimo", "stock min", "punto de reorden"] },
];

export const PLANTILLA: Celda[][] = [
  COLUMNAS.map((c) => c.titulo),
  ["Arroz 5 lb", "ARZ-5LB", "Granos", "Distribuidora Central", 2.6, 3.5, 40, 10],
  ["Aceite 900 ml", "ACE-900", "Abarrotes", "Distribuidora Central", 2.4, 3.25, 8, 10],
  ["Leche 1 L", "LEC-1L", "Lácteos", "Lácteos El Pastor", 0.9, 1.35, 24, 12],
];

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** CSV con coma, punto y coma o tabulador (Excel en español guarda con ";"), comillas y BOM. */
export function parseCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  const primera = limpio.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].sort((a, b) => primera.split(b).length - primera.split(a).length)[0];

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const ch = limpio[i];
    if (comillas) {
      if (ch === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (ch === '"') comillas = false;
      else celda += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) {
      fila.push(celda);
      celda = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += ch;
  }
  if (celda !== "" || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

/** "$1,250.50", "1.250,50", "3,5" o 3.5 -> número. */
export function aNumero(v: Celda): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  let s = v.replace(/[$\s]/g, "").replace(/USD/i, "");
  if (!s) return undefined;
  const coma = s.lastIndexOf(",");
  const punto = s.lastIndexOf(".");
  if (coma > -1 && punto > -1) {
    // el separador que aparece al final es el decimal
    s = coma > punto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (coma > -1) {
    // "3,5" decimal; "1,250" miles (3 dígitos exactos después de la coma)
    s = /^-?[1-9]\d{0,2}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const textoCelda = (v: Celda) => (v === null || v === undefined ? "" : String(v).trim());

/** Revisa cada fila con las mismas reglas del backend para mostrar los errores antes de enviar. */
export function revisarHoja(filas: Celda[][]): { columnasFaltantes: string[]; filas: FilaRevisada[] } {
  const iEncabezado = filas.findIndex((f) => f.some((c) => textoCelda(c) !== ""));
  if (iEncabezado < 0) return { columnasFaltantes: ["Nombre", "Precio compra", "Precio venta"], filas: [] };

  const encabezados = filas[iEncabezado].map((c) => normalizar(textoCelda(c)));
  const indice = new Map<keyof FilaProducto, number>();
  for (const col of COLUMNAS) {
    const i = encabezados.findIndex((h) => col.alias.includes(h));
    if (i > -1 && ![...indice.values()].includes(i)) indice.set(col.campo, i);
  }
  const columnasFaltantes = COLUMNAS.filter(
    (c) => ["nombre", "precioCompra", "precioVenta"].includes(c.campo) && !indice.has(c.campo)
  ).map((c) => c.titulo);
  if (columnasFaltantes.length) return { columnasFaltantes, filas: [] };

  const val = (fila: Celda[], campo: keyof FilaProducto) => {
    const i = indice.get(campo);
    return i === undefined ? undefined : fila[i];
  };

  const revisadas: FilaRevisada[] = [];
  filas.slice(iEncabezado + 1).forEach((fila, k) => {
    const numero = iEncabezado + k + 2;
    if (!fila.some((c) => textoCelda(c) !== "")) return; // fila en blanco

    const nombre = textoCelda(val(fila, "nombre"));
    const precioCompra = aNumero(val(fila, "precioCompra"));
    const precioVenta = aNumero(val(fila, "precioVenta"));
    const stockTxt = val(fila, "stock");
    const minTxt = val(fila, "stockMinimo");
    const stock = textoCelda(stockTxt) === "" ? undefined : aNumero(stockTxt);
    const stockMinimo = textoCelda(minTxt) === "" ? undefined : aNumero(minTxt);

    let error: string | undefined;
    if (!nombre) error = "Falta el nombre";
    else if (precioCompra === undefined || precioCompra < 0) error = "Precio de compra inválido";
    else if (precioVenta === undefined || precioVenta < 0) error = "Precio de venta inválido";
    else if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) error = "El stock debe ser un entero ≥ 0";
    else if (stockMinimo !== undefined && (!Number.isInteger(stockMinimo) || stockMinimo < 0)) error = "El stock mínimo debe ser un entero ≥ 0";

    if (error) {
      revisadas.push({ fila: numero, error });
      return;
    }
    const opcional = (campo: keyof FilaProducto) => textoCelda(val(fila, campo)) || undefined;
    revisadas.push({
      fila: numero,
      datos: {
        nombre,
        sku: opcional("sku"),
        categoria: opcional("categoria"),
        proveedor: opcional("proveedor"),
        precioCompra: precioCompra!,
        precioVenta: precioVenta!,
        stock,
        stockMinimo,
      },
    });
  });

  // SKU repetido dentro del archivo
  const vistos = new Map<string, number>();
  for (const r of revisadas) {
    const sku = r.datos?.sku?.toLowerCase();
    if (!sku) continue;
    if (vistos.has(sku)) {
      r.error = `SKU repetido (ya está en la fila ${vistos.get(sku)})`;
      r.datos = undefined;
    } else vistos.set(sku, r.fila);
  }
  return { columnasFaltantes: [], filas: revisadas };
}

/** Descarga un Blob con un nombre de archivo (sin dependencias). */
export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fechaArchivo = () => new Date().toISOString().slice(0, 10);

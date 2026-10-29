/**
 * Lectura y escritura mínima de hojas de Excel (.xlsx) sin librerías externas.
 *
 * Un .xlsx es un ZIP con XML adentro. Para leer: se recorre el directorio central del ZIP,
 * se descomprime cada entrada con `DecompressionStream("deflate-raw")` (nativo del navegador)
 * y se interpreta la primera hoja con `sharedStrings`. Para escribir: se arma un ZIP sin
 * compresión (método "store") con el XML mínimo que Excel, LibreOffice y Google Sheets aceptan.
 *
 * Alcance a propósito: una sola hoja, celdas de texto y número. Suficiente para cargar o
 * exportar un inventario; no pretende ser una librería completa de Excel.
 */

export type Celda = string | number | null | undefined;

// ---------------------------------------------------------------- ZIP

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function inflarRaw(datos: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([datos as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function leerZip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Fin del directorio central: firma 0x06054b50, buscada desde el final (puede haber comentario)
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("El archivo no es un Excel (.xlsx) válido");

  const total = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const archivos = new Map<string, Uint8Array>();

  for (let n = 0; n < total; n++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) throw new Error("Excel dañado (directorio central)");
    const metodo = view.getUint16(ptr + 10, true);
    const tamComprimido = view.getUint32(ptr + 20, true);
    const largoNombre = view.getUint16(ptr + 28, true);
    const largoExtra = view.getUint16(ptr + 30, true);
    const largoComentario = view.getUint16(ptr + 32, true);
    const offsetLocal = view.getUint32(ptr + 42, true);
    const nombre = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + largoNombre));

    const inicio = offsetLocal + 30 + view.getUint16(offsetLocal + 26, true) + view.getUint16(offsetLocal + 28, true);
    const datos = bytes.subarray(inicio, inicio + tamComprimido);
    if (metodo === 0) archivos.set(nombre, datos.slice());
    else if (metodo === 8) archivos.set(nombre, await inflarRaw(datos));
    // otros métodos de compresión no se usan en .xlsx

    ptr += 46 + largoNombre + largoExtra + largoComentario;
  }
  return archivos;
}

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function crearZip(archivos: [string, string][]): Uint8Array {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [nombre, contenido] of archivos) {
    const n = encoder.encode(nombre);
    const d = encoder.encode(contenido);
    const crc = crc32(d);

    const local = new Uint8Array(30 + n.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // versión mínima
    lv.setUint16(6, 0x0800, true); // nombres en UTF-8
    lv.setUint16(8, 0, true); // método: store
    lv.setUint32(14, crc, true);
    lv.setUint32(18, d.length, true);
    lv.setUint32(22, d.length, true);
    lv.setUint16(26, n.length, true);
    local.set(n, 30);
    partes.push(local, d);

    const cab = new Uint8Array(46 + n.length);
    const cv = new DataView(cab.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, d.length, true);
    cv.setUint32(24, d.length, true);
    cv.setUint16(28, n.length, true);
    cv.setUint32(42, offset, true);
    cab.set(n, 46);
    central.push(cab);

    offset += local.length + d.length;
  }

  const tamCentral = central.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const fv = new DataView(fin.buffer);
  fv.setUint32(0, 0x06054b50, true);
  fv.setUint16(8, archivos.length, true);
  fv.setUint16(10, archivos.length, true);
  fv.setUint32(12, tamCentral, true);
  fv.setUint32(16, offset, true);

  const todo = [...partes, ...central, fin];
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of todo) {
    salida.set(p, pos);
    pos += p.length;
  }
  return salida;
}

// ---------------------------------------------------------------- XML

function desescapar(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // caracteres de control no permitidos en XML 1.0
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

/** Texto de un nodo <si> o <is>: puede venir partido en varios <t> (texto con formato). */
function textoRico(xml: string): string {
  const partes = [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => desescapar(m[1]));
  return partes.join("");
}

/** "C12" -> índice de columna 2 (A = 0). */
function columna(ref: string): number {
  const letras = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function letraColumna(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ---------------------------------------------------------------- API

/** Lee la primera hoja de un .xlsx y devuelve sus filas (texto o número por celda). */
export async function leerXlsx(buffer: ArrayBuffer): Promise<Celda[][]> {
  const zip = await leerZip(buffer);

  // Ruta de la primera hoja según workbook.xml (normalmente xl/worksheets/sheet1.xml)
  let rutaHoja = "xl/worksheets/sheet1.xml";
  const workbook = zip.get("xl/workbook.xml");
  const rels = zip.get("xl/_rels/workbook.xml.rels");
  if (workbook && rels) {
    const rid = decoder.decode(workbook).match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
    const destino = rid
      ? decoder.decode(rels).match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ??
        decoder.decode(rels).match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`))?.[1]
      : undefined;
    if (destino) rutaHoja = destino.startsWith("/") ? destino.slice(1) : `xl/${destino}`;
  }
  const hoja = zip.get(rutaHoja);
  if (!hoja) throw new Error("El Excel no tiene hojas con datos");

  const compartidas: string[] = [];
  const ss = zip.get("xl/sharedStrings.xml");
  if (ss) for (const m of decoder.decode(ss).matchAll(/<si>([\s\S]*?)<\/si>/g)) compartidas.push(textoRico(m[1]));

  const filas: Celda[][] = [];
  for (const fila of decoder.decode(hoja).matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const numero = Number(fila[1].match(/\br="(\d+)"/)?.[1] ?? filas.length + 1);
    const celdas: Celda[] = [];
    let siguiente = 0;
    for (const c of fila[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const cuerpo = c[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const col = ref ? columna(ref) : siguiente;
      siguiente = col + 1;
      const tipo = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = cuerpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let valor: Celda = null;
      if (tipo === "s" && v !== undefined) valor = compartidas[Number(v)] ?? "";
      else if (tipo === "inlineStr") valor = textoRico(cuerpo);
      else if (tipo === "str" || tipo === "e") valor = v !== undefined ? desescapar(v) : null;
      else if (tipo === "b") valor = v === "1" ? 1 : 0;
      else if (v !== undefined) valor = Number(v);
      celdas[col] = valor;
    }
    filas[numero - 1] = celdas;
  }
  // filas vacías intermedias (huecos del arreglo) quedan como []
  return Array.from(filas, (f) => f ?? []);
}

/** Genera un .xlsx de una hoja. La primera fila se trata como encabezado (negrita y fija). */
export function crearXlsx(filas: Celda[][], nombreHoja = "Hoja1"): Blob {
  const xmlFilas = filas
    .map((fila, i) => {
      const celdas = fila
        .map((v, j) => {
          if (v === null || v === undefined || v === "") return "";
          const r = `${letraColumna(j)}${i + 1}`;
          const estilo = i === 0 ? ' s="1"' : "";
          if (typeof v === "number" && Number.isFinite(v)) return `<c r="${r}"${estilo}><v>${v}</v></c>`;
          return `<c r="${r}" t="inlineStr"${estilo}><is><t xml:space="preserve">${escapar(String(v))}</t></is></c>`;
        })
        .join("");
      return `<row r="${i + 1}">${celdas}</row>`;
    })
    .join("");

  const anchos = (filas[0] ?? [])
    .map((_, j) => {
      const largo = Math.max(...filas.map((f) => String(f[j] ?? "").length), 8);
      return `<col min="${j + 1}" max="${j + 1}" width="${Math.min(largo + 2, 50)}" customWidth="1"/>`;
    })
    .join("");

  const hoja =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    (anchos ? `<cols>${anchos}</cols>` : "") +
    `<sheetData>${xmlFilas}</sheetData></worksheet>`;

  const archivos: [string, string][] = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapar(nombreHoja.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    [
      "xl/styles.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ],
    ["xl/worksheets/sheet1.xml", hoja],
  ];

  return new Blob([crearZip(archivos) as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

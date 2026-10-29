import { useState, ChangeEvent } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { api, ApiError } from "../lib/api";
import { crearXlsx, leerXlsx, Celda } from "../lib/xlsx";
import { PLANTILLA, COLUMNAS, parseCsv, revisarHoja, descargar, FilaRevisada } from "../lib/hoja";

interface Resultado {
  creados: number;
  actualizados: number;
  categoriasCreadas: number;
  proveedoresCreados: number;
}

const MAX_MB = 5;

/**
 * Carga inicial de inventario: es el servicio de "implementación" del plan de negocios.
 * El archivo se lee en el navegador (Excel o CSV), se revisa fila por fila con las mismas
 * reglas del backend y solo se envía si no hay errores: el servidor lo guarda todo o nada.
 */
export default function Importar() {
  const [archivo, setArchivo] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const [filas, setFilas] = useState<FilaRevisada[]>([]);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const validas = filas.filter((f) => f.datos);
  const conError = filas.filter((f) => f.error);

  async function onArchivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo tras corregirlo
    if (!file) return;
    setError("");
    setResultado(null);
    setFilas([]);
    setFaltantes([]);
    setArchivo(file.name);
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo pesa más de ${MAX_MB} MB.`);
      return;
    }
    setLeyendo(true);
    try {
      const nombre = file.name.toLowerCase();
      let datos: Celda[][];
      if (nombre.endsWith(".xlsx")) datos = await leerXlsx(await file.arrayBuffer());
      else if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) datos = parseCsv(await file.text());
      else if (nombre.endsWith(".xls")) throw new Error("Es un Excel antiguo (.xls). Ábrelo en Excel y usa 'Guardar como' → Libro de Excel (.xlsx).");
      else throw new Error("Formato no reconocido. Sube un archivo .xlsx o .csv.");
      const revision = revisarHoja(datos);
      setFaltantes(revision.columnasFaltantes);
      setFilas(revision.filas);
      if (!revision.columnasFaltantes.length && revision.filas.length === 0) setError("La hoja no tiene productos debajo de los encabezados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo");
    } finally {
      setLeyendo(false);
    }
  }

  async function importar() {
    setEnviando(true);
    setError("");
    try {
      const res = await api.post<Resultado>("/productos/importar", { productos: validas.map((f) => f.datos) });
      setResultado(res);
      setFilas([]);
    } catch (err) {
      const detalle = err instanceof ApiError ? (err.data?.errores as { fila: number; error: string }[] | undefined) : undefined;
      if (detalle?.length) {
        // el servidor numera las filas enviadas; se traducen a las filas reales de la hoja
        const porIndice = new Map(detalle.map((d) => [d.fila - 2, d.error]));
        setFilas((prev) => {
          let enviada = -1;
          return prev.map((f) => {
            if (!f.datos) return f;
            enviada++;
            const msg = porIndice.get(enviada);
            return msg ? { fila: f.fila, error: msg } : f;
          });
        });
      }
      setError(err instanceof Error ? err.message : "No se pudo importar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <PageHeader title="Importar inventario" subtitle="Sube tu Excel y carga todos tus productos de una vez" />

      <Card className="mb-4">
        <h2 className="font-bold text-slate-900">1. Prepara tu hoja</h2>
        <p className="mt-1 text-sm text-slate-600">
          Usa la plantilla o tu propio Excel: reconocemos columnas como <b>Producto</b>, <b>Código</b>, <b>Costo</b>,{" "}
          <b>Precio</b> y <b>Existencias</b>. Obligatorias: nombre, precio de compra y precio de venta.
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {COLUMNAS.map((c) => (
            <li key={c.campo} className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
              {c.titulo}
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Button variant="ghost" size="sm" onClick={() => descargar(crearXlsx(PLANTILLA, "Productos"), "plantilla-instaya.xlsx")}>
            ⇩ Descargar plantilla Excel
          </Button>
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="font-bold text-slate-900">2. Sube el archivo</h2>
        <p className="mt-1 text-sm text-slate-600">Excel (.xlsx) o CSV. Si un producto ya existe (mismo SKU o nombre) se actualiza, no se duplica.</p>
        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-4 py-6 text-center hover:bg-brand-50">
          <span className="text-2xl text-brand-600">⇪</span>
          <span className="text-sm font-semibold text-brand-700">{archivo ? "Elegir otro archivo" : "Elegir archivo"}</span>
          {archivo && <span className="text-xs text-slate-500">{archivo}</span>}
          <input type="file" accept=".xlsx,.csv,.txt,.xls" className="sr-only" aria-label="Archivo de inventario" onChange={onArchivo} />
        </label>
        {leyendo && <p className="mt-3 text-center text-sm text-slate-500">Leyendo archivo...</p>}
      </Card>

      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {faltantes.length > 0 && (
        <div className="mb-4">
          <Alert tone="warning">
            No encontramos las columnas: <b>{faltantes.join(", ")}</b>. Revisa que la primera fila tenga los encabezados.
          </Alert>
        </div>
      )}

      {resultado && (
        <Card className="mb-4 ring-green-200">
          <h2 className="font-bold text-green-800">✓ Inventario importado</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700" data-testid="resultado-importacion">
            <li>{resultado.creados} productos nuevos</li>
            <li>{resultado.actualizados} productos actualizados</li>
            {resultado.categoriasCreadas > 0 && <li>{resultado.categoriasCreadas} categorías creadas</li>}
            {resultado.proveedoresCreados > 0 && <li>{resultado.proveedoresCreados} proveedores creados</li>}
          </ul>
          <p className="mt-2 text-xs text-slate-500">El stock cargado queda registrado en Movimientos como "Carga inicial".</p>
          <div className="mt-3">
            <Link to="/app/productos" className="text-sm font-semibold text-brand-700 underline">
              Ver productos →
            </Link>
          </div>
        </Card>
      )}

      {filas.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900">3. Revisa y confirma</h2>
            <span className="text-xs text-slate-500" data-testid="conteo-filas">
              {validas.length} listas{conError.length > 0 && ` · ${conError.length} con error`}
            </span>
          </div>

          {conError.length > 0 && (
            <div className="mb-3">
              <Alert tone="warning">
                Corrige las filas marcadas en tu archivo y vuelve a subirlo. No se importa nada mientras haya errores.
              </Alert>
            </div>
          )}

          <div className="max-h-80 overflow-auto rounded-xl ring-1 ring-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-2">Fila</th>
                  <th className="px-2 py-2">Producto</th>
                  <th className="px-2 py-2 text-right">Venta</th>
                  <th className="px-2 py-2 text-right">Stock</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.fila} className={f.error ? "bg-red-50" : "border-t border-slate-100"}>
                    <td className="px-2 py-1.5 text-slate-400">{f.fila}</td>
                    {f.error ? (
                      <td colSpan={3} className="px-2 py-1.5 font-medium text-red-700">
                        {f.error}
                      </td>
                    ) : (
                      <>
                        <td className="px-2 py-1.5">
                          <span className="font-medium text-slate-800">{f.datos!.nombre}</span>
                          {f.datos!.sku && <span className="ml-1 text-slate-400">{f.datos!.sku}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right">${f.datos!.precioVenta.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right">{f.datos!.stock ?? "—"}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Button fullWidth size="lg" disabled={enviando || conError.length > 0 || validas.length === 0} onClick={importar}>
              {enviando ? "Importando..." : `Importar ${validas.length} productos`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

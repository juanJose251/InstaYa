import { useEffect, useState, FormEvent } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import EmptyState from "../components/ui/EmptyState";
import Alert from "../components/ui/Alert";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";
import type { Producto } from "./Productos";

interface Movimiento {
  id: string;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE";
  cantidad: number;
  motivo?: string;
  createdAt: string;
  producto?: { nombre: string };
}

interface MovimientosResponse {
  movimientos: Movimiento[];
}

const tipoClase: Record<Movimiento["tipo"], string> = {
  ENTRADA: "bg-green-100 text-green-700",
  SALIDA: "bg-red-100 text-red-700",
  AJUSTE: "bg-amber-100 text-amber-700",
};

/** Busca en la API (GET /productos?q=) por nombre o código mientras se escribe. */
function BuscarProducto({ elegido, onElegir }: { elegido: Producto | null; onElegir: (p: Producto | null) => void }) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [fallo, setFallo] = useState("");

  useEffect(() => {
    const q = texto.trim();
    if (elegido || !q) {
      setResultados([]);
      setFallo("");
      return;
    }
    let vigente = true;
    // espera a que se deje de escribir para no llamar a la API en cada tecla
    const espera = setTimeout(async () => {
      setBuscando(true);
      try {
        const { productos } = await api.get<{ productos: Producto[] }>(`/productos?q=${encodeURIComponent(q)}`);
        if (vigente) {
          setResultados(productos.slice(0, 8));
          setFallo("");
        }
      } catch (err) {
        if (vigente) setFallo(err instanceof Error ? err.message : "No se pudo buscar");
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [texto, elegido]);

  if (elegido) {
    return (
      <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Producto *
        <div className="flex items-center justify-between gap-2 rounded-xl border border-brand-600 bg-brand-50 px-3 py-2.5">
          <span className="min-w-0 truncate text-slate-900">
            {elegido.nombre}
            {elegido.sku ? ` · ${elegido.sku}` : ""}
            <span className="font-normal text-slate-500"> — stock {elegido.stockActual}</span>
          </span>
          <button
            type="button"
            className="shrink-0 text-xs font-semibold text-brand-700"
            onClick={() => {
              onElegir(null);
              setTexto("");
            }}
          >
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  const q = texto.trim();
  return (
    <div>
      <Input
        label="Producto *"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escribe el nombre o el código (ej. arroz)"
        autoComplete="off"
      />
      {buscando && <p className="mt-1 text-xs text-slate-500">Buscando...</p>}
      {fallo && <p className="mt-1 text-xs text-red-600">{fallo}</p>}
      {!buscando && !fallo && q && resultados.length === 0 && (
        <p className="mt-1 text-xs text-slate-500">
          No hay productos que coincidan con "{q}". Créalo primero en Productos.
        </p>
      )}
      {resultados.length > 0 && (
        <ul className="mt-1 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => onElegir(p)}
              >
                <span className="min-w-0 truncate font-medium text-slate-900">
                  {p.nombre}
                  {p.sku && <span className="font-normal text-slate-500"> · {p.sku}</span>}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{p.stockActual} u.</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Movimientos() {
  const { data, cargando, error, recargar } = useData<MovimientosResponse>("/movimientos");
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [form, setForm] = useState({ productoId: "", tipo: "ENTRADA", cantidad: "", motivo: "" });
  const [elegido, setElegido] = useState<Producto | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.productoId) {
      setMsgError("Busca el producto por nombre o código y elígelo de la lista.");
      return;
    }
    setGuardando(true);
    setMsgError("");
    try {
      await api.post("/movimientos", {
        productoId: form.productoId,
        tipo: form.tipo,
        cantidad: Number(form.cantidad),
        motivo: form.motivo || undefined,
      });
      setMostrandoForm(false);
      setForm({ productoId: "", tipo: "ENTRADA", cantidad: "", motivo: "" });
      setElegido(null);
      recargar();
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Movimientos"
        subtitle="Entradas, salidas y ajustes de stock"
        action={
          <Button onClick={() => setMostrandoForm((v) => !v)}>
            {mostrandoForm ? "Cerrar" : "+ Registrar"}
          </Button>
        }
      />

      {mostrandoForm && (
        <form onSubmit={onSubmit} className="mb-5">
          <Card>
            <h2 className="mb-4 font-bold text-slate-900">Nuevo movimiento</h2>
            {msgError && (
              <div className="mb-4">
                <Alert tone="error">{msgError}</Alert>
              </div>
            )}
            <div className="space-y-4">
              <BuscarProducto
                elegido={elegido}
                onElegir={(p) => {
                  setElegido(p);
                  setForm((f) => ({ ...f, productoId: p?.id ?? "" }));
                }}
              />
              <div>
                <label className="text-sm font-medium text-slate-700">Tipo</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(["ENTRADA", "SALIDA", "AJUSTE"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, tipo: t }))}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                        form.tipo === t
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-slate-300 text-slate-600"
                      }`}
                    >
                      {t === "ENTRADA" ? "+ Entrada" : t === "SALIDA" ? "− Salida" : "± Ajuste"}
                    </button>
                  ))}
                </div>
              </div>
              <Input label="Cantidad *" type="number" min="1" required value={form.cantidad} onChange={(e) => setForm((p) => ({ ...p, cantidad: e.target.value }))} />
              <Input label="Motivo (opcional)" value={form.motivo} onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))} placeholder="Compra a proveedor, merma..." />
              <Button type="submit" fullWidth disabled={guardando}>
                {guardando ? "Guardando..." : "Registrar movimiento"}
              </Button>
            </div>
          </Card>
        </form>
      )}

      {error && (
        <div className="mb-4">
          <Alert tone="warning">
            No se pudo cargar: {error}. Revisa tu conexión e inténtalo de nuevo.
          </Alert>
        </div>
      )}

      {cargando && <p className="py-8 text-center text-sm text-slate-500">Cargando movimientos...</p>}

      {!cargando && !error && (!data?.movimientos || data.movimientos.length === 0) && (
        <Card>
          <EmptyState title="Sin movimientos" message="Registra entradas o salidas de stock." />
        </Card>
      )}

      {data?.movimientos && data.movimientos.length > 0 && (
        <div className="space-y-3">
          {data.movimientos.map((m) => (
            <Card key={m.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{m.producto?.nombre ?? "Producto"}</p>
                <p className="text-xs text-slate-500">
                  {m.motivo ? `${m.motivo} · ` : ""}
                  {new Date(m.createdAt).toLocaleString("es-SV")}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tipoClase[m.tipo]}`}>
                {m.tipo === "ENTRADA" ? "+" : m.tipo === "SALIDA" ? "−" : "±"}
                {m.cantidad}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
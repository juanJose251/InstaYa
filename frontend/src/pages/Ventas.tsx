import { useState, FormEvent } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import EmptyState from "../components/ui/EmptyState";
import Alert from "../components/ui/Alert";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";
import type { Producto } from "./Productos";

interface VentaItem {
  productoId: string;
  cantidad: number;
  subtotal: string;
  producto?: { nombre: string };
}

interface Venta {
  id: string;
  cliente?: string;
  total: string;
  status: "COMPLETADA" | "ANULADA";
  createdAt: string;
  items?: VentaItem[];
}

interface VentasResponse {
  ventas: Venta[];
}

interface Linea {
  productoId: string;
  cantidad: number;
}

type Modo = "productos" | "rapida";

export default function Ventas() {
  const { data, cargando, error, recargar } = useData<VentasResponse>("/ventas");
  const { data: catalogo } = useData<{ productos: Producto[] }>("/productos");
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [modo, setModo] = useState<Modo>("productos");
  const [guardando, setGuardando] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [cliente, setCliente] = useState("");
  const [total, setTotal] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [seleccion, setSeleccion] = useState({ productoId: "", cantidad: "1" });

  const productos = catalogo?.productos ?? [];
  const porId = new Map(productos.map((p) => [p.id, p]));
  // Estimación para mostrar al usuario; el servidor recalcula el total con los precios guardados.
  const totalEstimado = lineas.reduce((s, l) => s + Number(porId.get(l.productoId)?.precioVenta ?? 0) * l.cantidad, 0);

  function agregarLinea() {
    const cantidad = Number(seleccion.cantidad);
    const producto = porId.get(seleccion.productoId);
    if (!producto || !Number.isInteger(cantidad) || cantidad < 1) return;
    setMsgError("");
    const yaEnVenta = lineas.find((l) => l.productoId === producto.id)?.cantidad ?? 0;
    if (yaEnVenta + cantidad > producto.stockActual) {
      setMsgError(`Stock insuficiente de "${producto.nombre}" (disponible: ${producto.stockActual})`);
      return;
    }
    setLineas((prev) =>
      yaEnVenta
        ? prev.map((l) => (l.productoId === producto.id ? { ...l, cantidad: l.cantidad + cantidad } : l))
        : [...prev, { productoId: producto.id, cantidad }]
    );
    setSeleccion({ productoId: "", cantidad: "1" });
  }

  function cerrarForm() {
    setMostrandoForm(false);
    setCliente("");
    setTotal("");
    setLineas([]);
    setMsgError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (modo === "productos" && lineas.length === 0) {
      setMsgError("Agrega al menos un producto a la venta");
      return;
    }
    setGuardando(true);
    setMsgError("");
    try {
      await api.post("/ventas", {
        cliente: cliente || undefined,
        ...(modo === "productos" ? { items: lineas } : { total: Number(total) }),
      });
      cerrarForm();
      recargar();
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : "Error al registrar venta");
    } finally {
      setGuardando(false);
    }
  }

  async function anular(id: string) {
    if (!window.confirm("¿Anular esta venta? El stock de sus productos se repondrá.")) return;
    try {
      await api.post(`/ventas/${id}/anular`);
      recargar();
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : "No se pudo anular");
    }
  }

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle="Registro de ventas diarias"
        action={
          <Button onClick={() => (mostrandoForm ? cerrarForm() : setMostrandoForm(true))}>
            {mostrandoForm ? "Cerrar" : "+ Venta"}
          </Button>
        }
      />

      {mostrandoForm && (
        <form onSubmit={onSubmit} className="mb-5">
          <Card>
            <h2 className="mb-4 font-bold text-slate-900">Registrar venta</h2>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(
                [
                  ["productos", "Con productos"],
                  ["rapida", "Venta rápida"],
                ] as const
              ).map(([m, label]) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setModo(m)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                    modo === m ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {msgError && (
              <div className="mb-4">
                <Alert tone="error">{msgError}</Alert>
              </div>
            )}
            <div className="space-y-4">
              <Input label="Cliente (opcional)" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" />

              {modo === "rapida" ? (
                <Input label="Total ($)" type="number" step="0.01" min="0" required value={total} onChange={(e) => setTotal(e.target.value)} />
              ) : (
                <>
                  <div className="space-y-3">
                    <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700">
                      Producto
                      <select
                        aria-label="Producto"
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                        value={seleccion.productoId}
                        onChange={(e) => setSeleccion((s) => ({ ...s, productoId: e.target.value }))}
                      >
                        <option value="">Elige…</option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id} disabled={p.stockActual < 1}>
                            {p.nombre} (${Number(p.precioVenta).toFixed(2)} · {p.stockActual} u.)
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-[6rem_1fr] items-end gap-2">
                      <Input
                        aria-label="Cantidad"
                        label="Cantidad"
                        type="number"
                        min="1"
                        value={seleccion.cantidad}
                        onChange={(e) => setSeleccion((s) => ({ ...s, cantidad: e.target.value }))}
                      />
                      <Button type="button" variant="accent" onClick={agregarLinea} disabled={!seleccion.productoId}>
                        Agregar
                      </Button>
                    </div>
                  </div>

                  {lineas.length > 0 && (
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {lineas.map((l) => {
                        const p = porId.get(l.productoId);
                        return (
                          <li key={l.productoId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                            <span className="min-w-0 truncate">
                              {l.cantidad} × {p?.nombre}
                            </span>
                            <span className="flex items-center gap-3">
                              <span className="font-semibold">${(Number(p?.precioVenta ?? 0) * l.cantidad).toFixed(2)}</span>
                              <button
                                type="button"
                                aria-label={`Quitar ${p?.nombre}`}
                                className="text-red-600"
                                onClick={() => setLineas((prev) => prev.filter((x) => x.productoId !== l.productoId))}
                              >
                                ✕
                              </button>
                            </span>
                          </li>
                        );
                      })}
                      <li className="flex justify-between px-3 py-2 text-sm font-bold text-brand-700">
                        <span>Total</span>
                        <span data-testid="total-estimado">${totalEstimado.toFixed(2)}</span>
                      </li>
                    </ul>
                  )}
                </>
              )}

              <Button type="submit" fullWidth disabled={guardando}>
                {guardando ? "Guardando..." : "Registrar venta"}
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

      {cargando && <p className="py-8 text-center text-sm text-slate-500">Cargando ventas...</p>}

      {!cargando && !error && (!data?.ventas || data.ventas.length === 0) && (
        <Card>
          <EmptyState title="Sin ventas" message="Registra tu primera venta." />
        </Card>
      )}

      {data?.ventas && data.ventas.length > 0 && (
        <div className="space-y-3">
          {data.ventas.map((v) => (
            <Card key={v.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{v.cliente ?? "Venta"}</p>
                  <p className="text-xs text-slate-500">{new Date(v.createdAt).toLocaleString("es-SV")}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${v.status === "ANULADA" ? "text-slate-400 line-through" : "text-brand-700"}`}>
                    ${Number(v.total).toFixed(2)}
                  </p>
                  <span className={`text-[11px] font-semibold ${v.status === "COMPLETADA" ? "text-green-600" : "text-red-600"}`}>
                    {v.status === "COMPLETADA" ? "Completada" : "Anulada"}
                  </span>
                </div>
              </div>
              {v.items && v.items.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  {v.items.map((it) => `${it.cantidad} × ${it.producto?.nombre ?? "producto"}`).join(", ")}
                </p>
              )}
              {v.status === "COMPLETADA" && v.items && v.items.length > 0 && (
                <button className="mt-2 text-xs font-semibold text-red-600" onClick={() => anular(v.id)}>
                  Anular venta
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

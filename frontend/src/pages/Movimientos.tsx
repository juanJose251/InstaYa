import { useState, FormEvent } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import EmptyState from "../components/ui/EmptyState";
import Alert from "../components/ui/Alert";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";

interface Movimiento {
  id: string;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE";
  cantidad: number;
  motivo?: string;
  createdAt: string;
}

interface MovimientosResponse {
  movimientos: Movimiento[];
}

const tipoClase: Record<Movimiento["tipo"], string> = {
  ENTRADA: "bg-green-100 text-green-700",
  SALIDA: "bg-red-100 text-red-700",
  AJUSTE: "bg-amber-100 text-amber-700",
};

export default function Movimientos() {
  const { data, cargando, error, recargar } = useData<MovimientosResponse>("/movimientos");
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [form, setForm] = useState({ productoId: "", tipo: "ENTRADA", cantidad: "", motivo: "" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
              <Input label="ID del producto *" required value={form.productoId} onChange={(e) => setForm((p) => ({ ...p, productoId: e.target.value }))} placeholder="ID generado por la API" />
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
                <p className="font-semibold text-slate-900">{m.motivo ?? "Movimiento"}</p>
                <p className="text-xs text-slate-500">
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
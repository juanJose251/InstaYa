import { useState, FormEvent } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import EmptyState from "../components/ui/EmptyState";
import Alert from "../components/ui/Alert";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";

interface Venta {
  id: string;
  cliente?: string;
  total: string;
  status: "COMPLETADA" | "ANULADA";
  createdAt: string;
}

interface VentasResponse {
  ventas: Venta[];
}

export default function Ventas() {
  const { data, cargando, error, recargar } = useData<VentasResponse>("/ventas");
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [form, setForm] = useState({ cliente: "", total: "" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMsgError("");
    try {
      await api.post("/ventas", {
        cliente: form.cliente || undefined,
        total: Number(form.total),
      });
      setMostrandoForm(false);
      setForm({ cliente: "", total: "" });
      recargar();
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : "Error al registrar venta");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle="Registro de ventas diarias"
        action={
          <Button onClick={() => setMostrandoForm((v) => !v)}>
            {mostrandoForm ? "Cerrar" : "+ Venta"}
          </Button>
        }
      />

      {mostrandoForm && (
        <form onSubmit={onSubmit} className="mb-5">
          <Card>
            <h2 className="mb-4 font-bold text-slate-900">Registrar venta</h2>
            {msgError && (
              <div className="mb-4">
                <Alert tone="error">{msgError}</Alert>
              </div>
            )}
            <div className="space-y-4">
              <Input label="Cliente (opcional)" value={form.cliente} onChange={(e) => setForm((p) => ({ ...p, cliente: e.target.value }))} placeholder="Nombre del cliente" />
              <Input label="Total ($)" type="number" step="0.01" min="0" required value={form.total} onChange={(e) => setForm((p) => ({ ...p, total: e.target.value }))} />
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
            <Card key={v.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{v.cliente ?? "Venta"}</p>
                <p className="text-xs text-slate-500">
                  {new Date(v.createdAt).toLocaleString("es-SV")}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-brand-700">${Number(v.total).toFixed(2)}</p>
                <span
                  className={`text-[11px] font-semibold ${
                    v.status === "COMPLETADA" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {v.status === "COMPLETADA" ? "Completada" : "Anulada"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
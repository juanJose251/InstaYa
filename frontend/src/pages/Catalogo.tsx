import { useState, FormEvent } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import EmptyState from "../components/ui/EmptyState";
import Alert from "../components/ui/Alert";
import { useData } from "../hooks/useData";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

type Pestana = "categorias" | "proveedores";

interface Fila {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  _count?: { productos: number };
}

const vacio = { nombre: "", telefono: "", email: "" };

function Lista({ pestana, esAdmin }: { pestana: Pestana; esAdmin: boolean }) {
  const { data, cargando, error, recargar } = useData<Record<Pestana, Fila[]>>(`/${pestana}`);
  const [form, setForm] = useState(vacio);
  const [msgError, setMsgError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const singular = pestana === "categorias" ? "categoría" : "proveedor";
  const filas = data?.[pestana] ?? [];

  async function crear(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMsgError("");
    try {
      await api.post(`/${pestana}`, {
        nombre: form.nombre,
        ...(pestana === "proveedores" ? { telefono: form.telefono || undefined, email: form.email || undefined } : {}),
      });
      setForm(vacio);
      recargar();
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(fila: Fila) {
    if (!window.confirm(`¿Eliminar "${fila.nombre}"? Sus productos se conservan sin ${singular}.`)) return;
    try {
      await api.delete(`/${pestana}/${fila.id}`);
      recargar();
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }

  return (
    <div className="space-y-4">
      {esAdmin && (
        <form onSubmit={crear}>
          <Card>
            <div className="space-y-3">
              <Input label={`Nueva ${singular}`} required value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre" />
              {pestana === "proveedores" && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Teléfono" value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} />
                  <Input label="Correo" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
              )}
              <Button type="submit" fullWidth disabled={guardando}>
                {guardando ? "Guardando..." : `Agregar ${singular}`}
              </Button>
            </div>
          </Card>
        </form>
      )}

      {msgError && <Alert tone="error">{msgError}</Alert>}
      {error && <Alert tone="warning">No se pudo cargar: {error}</Alert>}
      {cargando && <p className="py-4 text-center text-sm text-slate-500">Cargando...</p>}
      {!cargando && !error && filas.length === 0 && (
        <Card>
          <EmptyState title={`Sin ${pestana}`} message={`Agrega la primera ${singular}.`} />
        </Card>
      )}

      <div className="space-y-3">
        {filas.map((f) => (
          <Card key={f.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{f.nombre}</p>
              <p className="text-xs text-slate-500">
                {f._count?.productos ?? 0} producto(s)
                {f.telefono && ` · ${f.telefono}`}
                {f.email && ` · ${f.email}`}
              </p>
            </div>
            {esAdmin && (
              <button className="text-xs font-semibold text-red-600" aria-label={`Eliminar ${f.nombre}`} onClick={() => borrar(f)}>
                Eliminar
              </button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Catalogo() {
  const { usuario } = useAuth();
  const [pestana, setPestana] = useState<Pestana>("categorias");

  return (
    <div>
      <PageHeader title="Catálogo" subtitle="Categorías y proveedores de tus productos" />
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["categorias", "proveedores"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              pestana === p ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-600"
            }`}
          >
            {p === "categorias" ? "Categorías" : "Proveedores"}
          </button>
        ))}
      </div>
      {!usuario || usuario.rol !== "ADMIN" ? (
        <div className="mb-4">
          <Alert tone="warning">Solo el administrador puede crear o eliminar. Aquí puedes consultar.</Alert>
        </div>
      ) : null}
      <Lista key={pestana} pestana={pestana} esAdmin={usuario?.rol === "ADMIN"} />
    </div>
  );
}

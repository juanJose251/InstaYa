import { useState, FormEvent } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import EmptyState from "../components/ui/EmptyState";
import Alert from "../components/ui/Alert";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";

export interface Producto {
  id: string;
  nombre: string;
  sku?: string;
  precioCompra: string;
  precioVenta: string;
  stockActual: number;
  stockMinimo: number;
  categoriaId?: string;
  categoria?: { nombre?: string } | null;
  proveedor?: { nombre?: string } | null;
}

interface Opcion {
  id: string;
  nombre: string;
}

interface ProductosResponse {
  productos: Producto[];
}

export default function Productos() {
  const { data, cargando, error, recargar } = useData<ProductosResponse>("/productos");
  const { data: cats } = useData<{ categorias: Opcion[] }>("/categorias");
  const { data: provs } = useData<{ proveedores: Opcion[] }>("/proveedores");
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [form, setForm] = useState({
    nombre: "",
    sku: "",
    precioCompra: "",
    precioVenta: "",
    stockMinimo: "0",
    categoriaId: "",
    proveedorId: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMsgError("");
    try {
      await api.post("/productos", {
        nombre: form.nombre,
        sku: form.sku || undefined,
        precioCompra: Number(form.precioCompra),
        precioVenta: Number(form.precioVenta),
        stockMinimo: Number(form.stockMinimo),
        categoriaId: form.categoriaId || undefined,
        proveedorId: form.proveedorId || undefined,
      });
      setMostrandoForm(false);
      setForm({ nombre: "", sku: "", precioCompra: "", precioVenta: "", stockMinimo: "0", categoriaId: "", proveedorId: "" });
      recargar();
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle="Catálogo y stock de tu empresa"
        action={
          <Button onClick={() => setMostrandoForm((v) => !v)}>
            {mostrandoForm ? "Cerrar" : "+ Nuevo"}
          </Button>
        }
      />

      {mostrandoForm && (
        <form onSubmit={onSubmit} className="mb-5">
          <Card>
            <h2 className="mb-4 font-bold text-slate-900">Nuevo producto</h2>
            {msgError && (
              <div className="mb-4">
                <Alert tone="error">{msgError}</Alert>
              </div>
            )}
            <div className="space-y-4">
              <Input label="Nombre *" required minLength={2} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Arroz tucan 5lb" />
              <Input label="SKU (opcional)" value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="ARZ-5LB" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Precio compra ($)" type="number" step="0.01" min="0" required value={form.precioCompra} onChange={(e) => set("precioCompra", e.target.value)} />
                <Input label="Precio venta ($)" type="number" step="0.01" min="0" required value={form.precioVenta} onChange={(e) => set("precioVenta", e.target.value)} />
              </div>
              <Input label="Stock mínimo" type="number" min="0" value={form.stockMinimo} onChange={(e) => set("stockMinimo", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Categoría
                  <select className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" value={form.categoriaId} onChange={(e) => set("categoriaId", e.target.value)}>
                    <option value="">Sin categoría</option>
                    {cats?.categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Proveedor
                  <select className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" value={form.proveedorId} onChange={(e) => set("proveedorId", e.target.value)}>
                    <option value="">Sin proveedor</option>
                    {provs?.proveedores.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Button type="submit" fullWidth disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar producto"}
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

      {cargando && <p className="py-8 text-center text-sm text-slate-500">Cargando productos...</p>}

      {!cargando && !error && (!data?.productos || data.productos.length === 0) && (
        <Card>
          <EmptyState
            title="Sin productos aún"
            message="Agrega tu primer producto con el botón '+ Nuevo'."
          />
        </Card>
      )}

      {data?.productos && data.productos.length > 0 && (
        <div className="space-y-3">
          {data.productos.map((p) => {
            const bajo = p.stockActual <= p.stockMinimo;
            return (
              <Card key={p.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{p.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {p.sku && `${p.sku} · `}${Number(p.precioVenta).toFixed(2)}
                    {p.categoria?.nombre && ` · ${p.categoria.nombre}`}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                      bajo ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}
                  >
                    {p.stockActual} u.
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
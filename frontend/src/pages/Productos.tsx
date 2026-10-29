import { useState, FormEvent, useMemo } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import EmptyState from "../components/ui/EmptyState";
import Alert from "../components/ui/Alert";
import { useData } from "../hooks/useData";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { crearXlsx } from "../lib/xlsx";
import { COLUMNAS, descargar, fechaArchivo } from "../lib/hoja";

export interface Producto {
  id: string;
  nombre: string;
  sku?: string | null;
  precioCompra: string;
  precioVenta: string;
  stockActual: number;
  stockMinimo: number;
  categoriaId?: string | null;
  proveedorId?: string | null;
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

const vacio = { nombre: "", sku: "", precioCompra: "", precioVenta: "", stockMinimo: "0", categoriaId: "", proveedorId: "" };
type Form = typeof vacio;

const selectClass = "rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";

export default function Productos() {
  const { esAdmin, suscripcion } = useAuth();
  const { data, cargando, error, recargar } = useData<ProductosResponse>("/productos");
  const { data: cats } = useData<{ categorias: Opcion[] }>("/categorias");
  const { data: provs } = useData<{ proveedores: Opcion[] }>("/proveedores");

  // null = formulario cerrado; "nuevo" = alta; un id = edición de ese producto
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(vacio);
  const [guardando, setGuardando] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [aviso, setAviso] = useState("");
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [soloBajo, setSoloBajo] = useState(false);

  const soloLectura = suscripcion?.soloLectura ?? false;
  const puedeEditar = esAdmin && !soloLectura;

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (data?.productos ?? []).filter(
      (p) =>
        (!q || p.nombre.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)) &&
        (!soloBajo || p.stockActual <= p.stockMinimo)
    );
  }, [data, busqueda, soloBajo]);
  const bajos = (data?.productos ?? []).filter((p) => p.stockActual <= p.stockMinimo).length;

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function abrirNuevo() {
    setForm(vacio);
    setMsgError("");
    setEditando((v) => (v === "nuevo" ? null : "nuevo"));
  }

  function abrirEdicion(p: Producto) {
    setForm({
      nombre: p.nombre,
      sku: p.sku ?? "",
      precioCompra: String(Number(p.precioCompra)),
      precioVenta: String(Number(p.precioVenta)),
      stockMinimo: String(p.stockMinimo),
      categoriaId: p.categoriaId ?? "",
      proveedorId: p.proveedorId ?? "",
    });
    setMsgError("");
    setPorBorrar(null);
    setEditando(p.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMsgError("");
    const cuerpo = {
      nombre: form.nombre.trim(),
      sku: form.sku.trim() || undefined,
      precioCompra: Number(form.precioCompra),
      precioVenta: Number(form.precioVenta),
      stockMinimo: Number(form.stockMinimo),
      categoriaId: form.categoriaId || undefined,
      proveedorId: form.proveedorId || undefined,
    };
    try {
      if (editando === "nuevo") {
        await api.post("/productos", cuerpo);
        setAviso(`Producto "${cuerpo.nombre}" creado. Registra su stock en Movimientos → Entrada.`);
      } else {
        await api.put(`/productos/${editando}`, cuerpo);
        setAviso(`Cambios guardados en "${cuerpo.nombre}".`);
      }
      setEditando(null);
      setForm(vacio);
      recargar();
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(p: Producto) {
    setMsgError("");
    try {
      await api.delete(`/productos/${p.id}`);
      setPorBorrar(null);
      setAviso(`"${p.nombre}" se dio de baja. Sus ventas y movimientos se conservan en el historial.`);
      recargar();
    } catch (err) {
      setAviso("");
      setMsgError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }

  function exportar() {
    const filas = [
      COLUMNAS.map((c) => c.titulo).concat(["Valor en inventario ($)", "Estado"]),
      ...(data?.productos ?? []).map((p) => [
        p.nombre,
        p.sku ?? "",
        p.categoria?.nombre ?? "",
        p.proveedor?.nombre ?? "",
        Number(p.precioCompra),
        Number(p.precioVenta),
        p.stockActual,
        p.stockMinimo,
        Math.round(Number(p.precioCompra) * p.stockActual * 100) / 100,
        p.stockActual <= p.stockMinimo ? "Reponer" : "OK",
      ]),
    ];
    descargar(crearXlsx(filas, "Inventario"), `inventario-${fechaArchivo()}.xlsx`);
  }

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle="Catálogo y stock de tu empresa"
        action={
          puedeEditar ? (
            <Button onClick={abrirNuevo}>{editando === "nuevo" ? "Cerrar" : "+ Nuevo"}</Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {puedeEditar && (
          <Link
            to="/app/importar"
            className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            ⇪ Importar Excel
          </Link>
        )}
        <button
          type="button"
          onClick={exportar}
          disabled={!data?.productos.length}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          ⇩ Exportar a Excel
        </button>
      </div>

      {aviso && (
        <div className="mb-4">
          <Alert tone="success">{aviso}</Alert>
        </div>
      )}

      {editando && (
        <form onSubmit={onSubmit} className="mb-5">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">{editando === "nuevo" ? "Nuevo producto" : "Editar producto"}</h2>
              {editando !== "nuevo" && (
                <button type="button" className="text-sm font-semibold text-slate-500" onClick={() => setEditando(null)}>
                  Cancelar
                </button>
              )}
            </div>
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
              {Number(form.precioVenta) > 0 && Number(form.precioCompra) > 0 && (
                <p className="-mt-2 text-xs text-slate-500" data-testid="margen">
                  Margen: ${(Number(form.precioVenta) - Number(form.precioCompra)).toFixed(2)} por unidad (
                  {Math.round(((Number(form.precioVenta) - Number(form.precioCompra)) / Number(form.precioVenta)) * 100)}%)
                </p>
              )}
              <Input label="Stock mínimo (alerta)" type="number" min="0" value={form.stockMinimo} onChange={(e) => set("stockMinimo", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Categoría
                  <select className={selectClass} value={form.categoriaId} onChange={(e) => set("categoriaId", e.target.value)}>
                    <option value="">Sin categoría</option>
                    {cats?.categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Proveedor
                  <select className={selectClass} value={form.proveedorId} onChange={(e) => set("proveedorId", e.target.value)}>
                    <option value="">Sin proveedor</option>
                    {provs?.proveedores.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Button type="submit" fullWidth disabled={guardando}>
                {guardando ? "Guardando..." : editando === "nuevo" ? "Guardar producto" : "Guardar cambios"}
              </Button>
            </div>
          </Card>
        </form>
      )}

      {!editando && msgError && (
        <div className="mb-4">
          <Alert tone="error">{msgError}</Alert>
        </div>
      )}

      {data?.productos && data.productos.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <input
            type="search"
            aria-label="Buscar producto"
            placeholder="Buscar por nombre o SKU..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="button"
            onClick={() => setSoloBajo((v) => !v)}
            aria-pressed={soloBajo}
            className={`shrink-0 rounded-xl border px-3 py-2.5 text-xs font-semibold ${
              soloBajo ? "border-red-300 bg-red-50 text-red-700" : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            Stock bajo ({bajos})
          </button>
        </div>
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
            message={puedeEditar ? "Agrega tu primer producto con '+ Nuevo' o sube tu inventario completo con 'Importar Excel'." : "El administrador aún no ha cargado productos."}
          />
        </Card>
      )}

      {data?.productos && data.productos.length > 0 && visibles.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">Ningún producto coincide con la búsqueda.</p>
      )}

      <div className="space-y-3">
        {visibles.map((p) => {
          const bajo = p.stockActual <= p.stockMinimo;
          return (
            <Card key={p.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{p.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {p.sku && `${p.sku} · `}${Number(p.precioVenta).toFixed(2)}
                    {p.categoria?.nombre && ` · ${p.categoria.nombre}`}
                    {` · mín. ${p.stockMinimo}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                      bajo ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}
                  >
                    {p.stockActual} u.
                  </span>
                  {puedeEditar && (
                    <>
                      <button
                        type="button"
                        aria-label={`Editar ${p.nombre}`}
                        onClick={() => abrirEdicion(p)}
                        className="rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar ${p.nombre}`}
                        onClick={() => setPorBorrar((v) => (v === p.id ? null : p.id))}
                        className="rounded-lg px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
              {porBorrar === p.id && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm">
                  <span className="text-red-800">¿Dar de baja "{p.nombre}"? El historial se conserva.</span>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPorBorrar(null)}>
                      No
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => eliminar(p)}>
                      Sí, eliminar
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Alert from "../components/ui/Alert";
import { useData } from "../hooks/useData";

type Rango = "hoy" | "semana" | "mes";

interface Resumen {
  totalProductos: number;
  stockBajo: number;
  valorInventario: number;
  numeroVentas: number;
  totalVentas: number;
  numeroMovimientos?: number;
}

interface TopProductos {
  productos: { id: string; nombre: string; unidades: number; ingresos: number }[];
}

const dinero = (n?: number) => "$" + (n ?? 0).toFixed(2);

export default function Reportes() {
  const [rango, setRango] = useState<Rango>("hoy");
  const { data, cargando, error } = useData<Resumen>(`/reportes/resumen?rango=${rango}`);
  const { data: top } = useData<TopProductos>(`/reportes/top-productos?rango=${rango}`);

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Inventario, ventas y valoración" />

      <div className="mb-4 grid grid-cols-3 gap-2">
        {(["hoy", "semana", "mes"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRango(r)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition-colors ${
              rango === r
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-slate-300 text-slate-600"
            }`}
          >
            {r === "hoy" ? "Hoy" : r === "semana" ? "Semana" : "Mes"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4">
          <Alert tone="warning">No se pudo cargar el resumen: {error}</Alert>
        </div>
      )}

      {cargando && <p className="py-4 text-center text-sm text-slate-500">Cargando...</p>}

      <div className="space-y-3">
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">Ventas ({rango})</p>
            <p className="text-xs text-slate-500">Total de dinero generado</p>
          </div>
          <p className="text-lg font-bold text-brand-700">{dinero(data?.totalVentas)}</p>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">Valor del inventario</p>
            <p className="text-xs text-slate-500">Suma de precio de compra × stock</p>
          </div>
          <p className="text-lg font-bold text-brand-700">{dinero(data?.valorInventario)}</p>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">Productos con stock bajo</p>
            <p className="text-xs text-slate-500">Igual o menor al stock mínimo</p>
          </div>
          <p className="text-lg font-bold text-accent-600">{data?.stockBajo ?? 0}</p>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">Movimientos registrados</p>
            <p className="text-xs text-slate-500">Entradas y salidas ({rango})</p>
          </div>
          <p className="text-lg font-bold text-brand-700">{data?.numeroMovimientos ?? 0}</p>
        </Card>
      </div>

      <h2 className="mt-6 mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Más vendidos ({rango})</h2>
      <Card>
        {!top || top.productos.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay ventas con productos en este periodo.</p>
        ) : (
          <ol className="space-y-2" data-testid="top-productos">
            {top.productos.map((p, i) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="mr-2 font-bold text-brand-700">{i + 1}.</span>
                  {p.nombre}
                </span>
                <span className="text-right">
                  <span className="font-semibold">{p.unidades} u.</span>
                  <span className="ml-2 text-xs text-slate-500">{dinero(p.ingresos)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
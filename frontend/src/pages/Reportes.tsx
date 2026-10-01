import { useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Alert from "../components/ui/Alert";

type Rango = "hoy" | "semana" | "mes";

export default function Reportes() {
  const [rango, setRango] = useState<Rango>("hoy");
  const [msg] = useState("");

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

      {msg && (
        <div className="mb-4">
          <Alert tone="info">{msg}</Alert>
        </div>
      )}

      <div className="space-y-3">
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">Ventas ({rango})</p>
            <p className="text-xs text-slate-500">Total de dinero generado</p>
          </div>
          <p className="text-lg font-bold text-brand-700">$0.00</p>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">Valor del inventario</p>
            <p className="text-xs text-slate-500">Suma de precio de compra × stock</p>
          </div>
          <p className="text-lg font-bold text-brand-700">$0.00</p>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">Productos con stock bajo</p>
            <p className="text-xs text-slate-500">Igual o menor al stock mínimo</p>
          </div>
          <p className="text-lg font-bold text-accent-600">0</p>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">Movimientos registrados</p>
            <p className="text-xs text-slate-500">Entradas y salidas ({rango})</p>
          </div>
          <p className="text-lg font-bold text-brand-700">0</p>
        </Card>
      </div>

      <div className="mt-4">
        <Alert tone="info">
          Los reportes se calcularán con datos reales cuando el backend exponga los módulos de
          inventario (Fase 2) y ventas (Fase 3).
        </Alert>
      </div>
    </div>
  );
}
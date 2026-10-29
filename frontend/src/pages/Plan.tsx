import { useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { useData } from "../hooks/useData";
import { useAuth } from "../context/AuthContext";
import { api, DEMO } from "../lib/api";
import type { Suscripcion } from "../types";
import { textoEstado } from "../lib/suscripcion";

interface PlanResponse {
  suscripcion: Suscripcion;
  precios: { implementacion: number; mensual: number; diasPrueba: number; moneda: string };
  pago: { metodos: string[]; contacto: string; instrucciones: string };
}

const incluye = [
  "Usuarios ilimitados con roles (administrador y empleados)",
  "Inventario, ventas, movimientos y alertas de stock mínimo",
  "Reportes y exportación a Excel",
  "Asistente de reposición",
  "Alojamiento en la nube, respaldos y actualizaciones",
  "Soporte técnico por WhatsApp y correo",
];

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-SV", { day: "numeric", month: "long", year: "numeric" }) : "—");

export default function Plan() {
  const { esAdmin, refrescar } = useAuth();
  const { data, cargando, error, recargar } = useData<PlanResponse>("/suscripcion");
  const [msg, setMsg] = useState("");
  const s = data?.suscripcion;

  async function simular(ruta: "pagar" | "vencer") {
    setMsg("");
    try {
      await api.post(`/suscripcion/demo/${ruta}`, { meses: 1 });
      await refrescar();
      recargar();
      setMsg(ruta === "pagar" ? "Pago simulado: plan Básico activo por 1 mes más." : "Simulado: el plan venció. La cuenta queda en solo lectura.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <div>
      <PageHeader title="Plan y facturación" subtitle="Tu suscripción a InstaYa!" />

      {error && <Alert tone="warning">No se pudo cargar el plan: {error}</Alert>}
      {cargando && <p className="py-6 text-center text-sm text-slate-500">Cargando...</p>}

      {s && data && (
        <div className="space-y-4">
          <Card
            className={
              s.estado === "VENCIDA" ? "ring-red-200 bg-red-50" : s.estado === "PRUEBA" ? "ring-accent-200 bg-accent-50" : "ring-green-200 bg-green-50"
            }
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Estado</p>
            <p className="mt-1 text-lg font-bold text-slate-900" data-testid="estado-plan">
              {textoEstado(s)}
            </p>
            <p className="text-sm text-slate-600">
              {s.estado === "VENCIDA" ? "Venció el" : "Vence el"} {fecha(s.venceEl)}
            </p>
            {s.soloLectura && (
              <p className="mt-2 text-sm text-red-800">
                Tu cuenta está en <b>solo lectura</b>: puedes ver y exportar todo, pero no registrar ventas ni cambios hasta renovar.
                Tus datos no se borran.
              </p>
            )}
          </Card>

          <Card>
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold text-slate-900">Plan Básico</h2>
              <p>
                <span className="text-2xl font-black text-brand-700">${data.precios.mensual}</span>
                <span className="text-sm text-slate-500"> /mes</span>
              </p>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              + <b>${data.precios.implementacion}</b> de implementación, una sola vez: configuramos tu cuenta, cargamos tu inventario
              inicial desde tu Excel o cuaderno y capacitamos a tu personal.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
              {incluye.map((i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  {i}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="font-bold text-slate-900">Cómo pagar</h2>
            <p className="mt-1 text-sm text-slate-600">{data.pago.instrucciones}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.pago.metodos.map((m) => (
                <span key={m} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {m}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm">
              Comprobantes y soporte: <a className="font-semibold text-brand-700 underline" href={`mailto:${data.pago.contacto}`}>{data.pago.contacto}</a>
            </p>
          </Card>

          {DEMO && esAdmin && (
            <Card className="bg-slate-50">
              <h2 className="font-bold text-slate-900">Simulador (solo en la demo)</h2>
              <p className="mt-1 text-sm text-slate-600">
                Para mostrar el ciclo completo sin pagos reales. En producción el plan lo activa el operador al confirmar el pago.
              </p>
              {msg && (
                <div className="mt-3">
                  <Alert tone="info">{msg}</Alert>
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="accent" onClick={() => simular("pagar")}>
                  Simular pago ($10)
                </Button>
                <Button variant="ghost" onClick={() => simular("vencer")}>
                  Simular vencimiento
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

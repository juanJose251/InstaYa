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
  pago: { metodos: string[]; contacto: string; instrucciones: string; tienda?: string | null };
}

interface LicenciaResponse {
  licencia: { lic: string; negocio: string; email: string; vence: string } | null;
  tienda: string | null;
}

const incluye = (local: boolean) => [
  "Usuarios ilimitados con roles (administrador y empleados)",
  "Inventario, ventas, movimientos y alertas de stock mínimo",
  "Reportes y exportación a Excel",
  "Asistente de reposición",
  local ? "Funciona sin internet; tus datos quedan en esta computadora" : "Alojamiento en la nube, respaldos y actualizaciones",
  "Soporte técnico por WhatsApp y correo",
];

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-SV", { day: "numeric", month: "long", year: "numeric" }) : "—");

/** Instalación local: activar la clave comprada, renovar en la tienda y traer la renovación. */
function LicenciaCard({ tienda, alCambiar }: { tienda: string; alCambiar: () => Promise<void> }) {
  const { data, recargar } = useData<LicenciaResponse>("/licencia");
  const [clave, setClave] = useState("");
  const [msg, setMsg] = useState<{ tono: "success" | "error" | "info"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const lic = data?.licencia;

  async function correr(accion: () => Promise<string>) {
    setMsg(null);
    setOcupado(true);
    try {
      const texto = await accion();
      await alCambiar();
      recargar();
      setMsg({ tono: "success", texto });
    } catch (err) {
      setMsg({ tono: "error", texto: err instanceof Error ? err.message : "Error" });
    } finally {
      setOcupado(false);
    }
  }

  const activar = () =>
    correr(async () => {
      await api.post("/licencia", { clave });
      setClave("");
      return "Licencia activada. ¡Gracias por tu compra!";
    });

  const sincronizar = () =>
    correr(async () => {
      const r = await api.post<{ renovada: boolean }>("/licencia/sincronizar", {});
      if (!r.renovada) throw new Error("Todavía no vemos un pago nuevo. Revisa tu conexión a internet o intenta en unos minutos.");
      return "Licencia renovada.";
    });

  return (
    <Card>
      <h2 className="font-bold text-slate-900">Tu licencia</h2>
      {lic ? (
        <p className="mt-1 text-sm text-slate-600">
          Código <b className="font-mono">{lic.lic}</b> · {lic.negocio} · vence el {fecha(lic.vence)}
        </p>
      ) : (
        <p className="mt-1 text-sm text-slate-600">Compra tu licencia con tarjeta y pega aquí la clave que te damos al pagar.</p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <a
          href={lic ? `${tienda}/comprar?lic=${lic.lic}` : `${tienda}/comprar`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-accent-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-accent-600"
        >
          {lic ? "Renovar ($10 / mes)" : "Comprar licencia ($10 / mes)"}
        </a>
        {lic && (
          <Button variant="ghost" onClick={sincronizar} disabled={ocupado}>
            Ya pagué: actualizar
          </Button>
        )}
      </div>

      <label className="mt-4 block text-sm font-semibold text-slate-700">
        Clave de licencia
        <textarea
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          rows={3}
          placeholder="Pega aquí la clave completa"
          className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 font-mono text-xs"
          data-testid="input-licencia"
        />
      </label>
      <div className="mt-2">
        <Button onClick={activar} disabled={ocupado || clave.trim().length < 20} fullWidth>
          Activar
        </Button>
      </div>
      {msg && (
        <div className="mt-3">
          <Alert tone={msg.tono}>{msg.texto}</Alert>
        </div>
      )}
    </Card>
  );
}

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
              {data.pago.tienda ? (
                <>Pagas con tarjeta, mes a mes y sin contratos. Implementación opcional de ${data.precios.implementacion}.</>
              ) : (
                <>
                  + <b>${data.precios.implementacion}</b> de implementación, una sola vez: configuramos tu cuenta, cargamos tu inventario
                  inicial desde tu Excel o cuaderno y capacitamos a tu personal.
                </>
              )}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
              {incluye(!!data.pago.tienda).map((i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  {i}
                </li>
              ))}
            </ul>
          </Card>

          {data.pago.tienda && esAdmin && <LicenciaCard tienda={data.pago.tienda} alCambiar={async () => (await refrescar(), recargar())} />}

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

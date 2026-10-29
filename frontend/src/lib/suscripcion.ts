/** Mismas reglas que backend/src/lib/suscripcion.ts (la demo las necesita en el navegador). */
import type { Suscripcion } from "../types";

export const PRECIOS = { implementacion: 50, mensual: 10, diasPrueba: 15, moneda: "USD" } as const;

const DIA_MS = 24 * 60 * 60 * 1000;

export function calcularSuscripcion(
  empresa: { plan?: "PRUEBA" | "BASICO" | null; trialFin?: string | null; suscripcionFin?: string | null },
  ahora: Date = new Date()
): Suscripcion {
  const plan = empresa.plan === "BASICO" ? "BASICO" : "PRUEBA";
  const fin = plan === "BASICO" ? empresa.suscripcionFin : empresa.trialFin;
  if (!fin) return { plan, estado: plan === "BASICO" ? "ACTIVA" : "PRUEBA", venceEl: null, diasRestantes: null, soloLectura: false };
  const restante = new Date(fin).getTime() - ahora.getTime();
  const vencida = restante <= 0;
  return {
    plan,
    estado: vencida ? "VENCIDA" : plan === "BASICO" ? "ACTIVA" : "PRUEBA",
    venceEl: new Date(fin).toISOString(),
    diasRestantes: vencida ? 0 : Math.ceil(restante / DIA_MS),
    soloLectura: vencida,
  };
}

export function extenderSuscripcion(actual: string | null | undefined, meses: number, ahora: Date = new Date()): Date {
  const base = actual && new Date(actual).getTime() > ahora.getTime() ? new Date(actual) : new Date(ahora);
  base.setMonth(base.getMonth() + meses);
  return base;
}

/** Texto corto del estado del plan para avisos y la pantalla de Plan. */
export function textoEstado(s: Suscripcion | null | undefined): string {
  if (!s) return "";
  if (s.estado === "VENCIDA") return s.plan === "PRUEBA" ? "Tu prueba gratuita terminó" : "Tu mes pagado venció";
  if (s.estado === "PRUEBA") return s.diasRestantes === null ? "Prueba gratuita" : `Prueba gratuita: ${s.diasRestantes} día${s.diasRestantes === 1 ? "" : "s"} restantes`;
  return s.diasRestantes === null ? "Plan Básico activo" : `Plan Básico activo: ${s.diasRestantes} días restantes`;
}

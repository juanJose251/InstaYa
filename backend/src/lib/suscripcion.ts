/**
 * Modelo comercial de InstaYa! (plan de negocios, sección de precios):
 * - Prueba gratuita de 15 días al registrarse.
 * - Implementación única de $50 (configuración + carga inicial del inventario).
 * - Mantenimiento mensual de $10 (alojamiento, respaldos, soporte y actualizaciones).
 *
 * Cuando la prueba o el mes pagado vencen, la cuenta queda en SOLO LECTURA:
 * el negocio sigue viendo y exportando sus datos, pero no puede registrar nada nuevo
 * hasta renovar. Nunca se borra ni se bloquea el acceso a la información del cliente.
 */

export const PRECIOS = {
  implementacion: 50,
  mensual: 10,
  diasPrueba: 15,
  moneda: "USD",
} as const;

export type EstadoSuscripcion = "PRUEBA" | "ACTIVA" | "VENCIDA";

export interface DatosPlanEmpresa {
  plan?: "PRUEBA" | "BASICO" | null;
  trialFin?: Date | string | null;
  suscripcionFin?: Date | string | null;
}

export interface Suscripcion {
  plan: "PRUEBA" | "BASICO";
  estado: EstadoSuscripcion;
  venceEl: string | null;
  diasRestantes: number | null;
  soloLectura: boolean;
}

const DIA_MS = 24 * 60 * 60 * 1000;

export function calcularSuscripcion(empresa: DatosPlanEmpresa, ahora: Date = new Date()): Suscripcion {
  const plan = empresa.plan === "BASICO" ? "BASICO" : "PRUEBA";
  const fin = plan === "BASICO" ? empresa.suscripcionFin : empresa.trialFin;

  // Empresas creadas antes de que existiera el plan (sin fecha): no se les corta el servicio.
  if (!fin) {
    return { plan, estado: plan === "BASICO" ? "ACTIVA" : "PRUEBA", venceEl: null, diasRestantes: null, soloLectura: false };
  }

  const finDate = new Date(fin);
  const restante = finDate.getTime() - ahora.getTime();
  const vencida = restante <= 0;
  return {
    plan,
    estado: vencida ? "VENCIDA" : plan === "BASICO" ? "ACTIVA" : "PRUEBA",
    venceEl: finDate.toISOString(),
    diasRestantes: vencida ? 0 : Math.ceil(restante / DIA_MS),
    soloLectura: vencida,
  };
}

/** Nueva fecha de vencimiento al pagar `meses`: se suma desde hoy o desde el vencimiento actual si aún no llega. */
export function extenderSuscripcion(actual: Date | string | null | undefined, meses: number, ahora: Date = new Date()): Date {
  const base = actual && new Date(actual).getTime() > ahora.getTime() ? new Date(actual) : new Date(ahora);
  const nueva = new Date(base);
  nueva.setMonth(nueva.getMonth() + meses);
  return nueva;
}

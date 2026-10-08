/**
 * Misma regla de reposición que backend/src/lib/reposicion.ts, para que la demo (sin servidor)
 * se comporte igual que la API real. Si cambias una, cambia la otra.
 */
export interface FilaConsumo {
  id: string;
  nombre: string;
  stock: number;
  minimo: number;
  /** Unidades vendidas en los últimos 30 días */
  vendidas: number;
}

export interface Sugerencia {
  productoId: string;
  nombre: string;
  stock: number;
  minimo: number;
  ventasPorDia: number;
  diasCobertura: number | null;
  cantidadSugerida: number;
  motivo: "SIN_STOCK" | "BAJO_MINIMO" | "SE_ACABA_PRONTO";
}

export const VENTANA_DIAS = 30;
const DIAS_ALERTA = 7;
const DIAS_OBJETIVO = 14;

export function calcularSugerencias(filas: FilaConsumo[]): Sugerencia[] {
  const sugerencias: Sugerencia[] = [];
  for (const f of filas) {
    const ventasPorDia = f.vendidas / VENTANA_DIAS;
    const diasCobertura = ventasPorDia > 0 ? f.stock / ventasPorDia : null;

    let motivo: Sugerencia["motivo"] | null = null;
    if (f.stock <= 0) motivo = "SIN_STOCK";
    else if (f.stock <= f.minimo) motivo = "BAJO_MINIMO";
    else if (diasCobertura !== null && diasCobertura < DIAS_ALERTA) motivo = "SE_ACABA_PRONTO";
    if (!motivo) continue;

    const objetivo = Math.max(Math.ceil(ventasPorDia * DIAS_OBJETIVO), f.minimo * 2);
    sugerencias.push({
      productoId: f.id,
      nombre: f.nombre,
      stock: f.stock,
      minimo: f.minimo,
      ventasPorDia: Math.round(ventasPorDia * 100) / 100,
      diasCobertura: diasCobertura === null ? null : Math.round(diasCobertura * 10) / 10,
      cantidadSugerida: Math.max(objetivo - f.stock, 1),
      motivo,
    });
  }
  const prioridad = { SIN_STOCK: 0, SE_ACABA_PRONTO: 1, BAJO_MINIMO: 2 } as const;
  return sugerencias.sort((a, b) => prioridad[a.motivo] - prioridad[b.motivo] || a.nombre.localeCompare(b.nombre));
}

export function resumenPorReglas(sugerencias: Sugerencia[]): string {
  if (sugerencias.length === 0) return "El inventario está sano: ningún producto necesita reposición ahora.";
  const sinStock = sugerencias.filter((s) => s.motivo === "SIN_STOCK").length;
  const top = sugerencias.slice(0, 3).map((s) => `${s.nombre} (pedir ${s.cantidadSugerida})`).join(", ");
  return `${sugerencias.length} producto(s) necesitan reposición${sinStock ? `, ${sinStock} sin stock` : ""}. Prioridad: ${top}.`;
}

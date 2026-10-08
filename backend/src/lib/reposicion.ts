import { env } from "../config/env";

export interface FilaConsumo {
  id: string;
  nombre: string;
  stock: number;
  minimo: number;
  /** Unidades vendidas en la ventana analizada */
  vendidas: number;
}

export interface Sugerencia {
  productoId: string;
  nombre: string;
  stock: number;
  minimo: number;
  ventasPorDia: number;
  /** Días que alcanza el stock al ritmo actual (null si no hay ventas) */
  diasCobertura: number | null;
  /** Unidades a pedir para cubrir DIAS_OBJETIVO días */
  cantidadSugerida: number;
  motivo: "SIN_STOCK" | "BAJO_MINIMO" | "SE_ACABA_PRONTO";
}

export const VENTANA_DIAS = 30;
export const DIAS_ALERTA = 7;
export const DIAS_OBJETIVO = 14;

/** Regla pura (sin BD ni red): qué productos reponer y cuánto. */
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
    const cantidadSugerida = Math.max(objetivo - f.stock, 1);
    sugerencias.push({
      productoId: f.id,
      nombre: f.nombre,
      stock: f.stock,
      minimo: f.minimo,
      ventasPorDia: Math.round(ventasPorDia * 100) / 100,
      diasCobertura: diasCobertura === null ? null : Math.round(diasCobertura * 10) / 10,
      cantidadSugerida,
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

/**
 * Resumen en lenguaje natural con un LLM (API de Anthropic, vía fetch).
 * Si no hay clave o la llamada falla, se usa el resumen por reglas: la IA es un extra, nunca un requisito.
 */
export async function resumenConIA(
  sugerencias: Sugerencia[]
): Promise<{ resumen: string; fuente: "ia" | "reglas" }> {
  const respaldo = { resumen: resumenPorReglas(sugerencias), fuente: "reglas" as const };
  if (!env.anthropicApiKey || sugerencias.length === 0) return respaldo;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "content-type": "application/json",
        "x-api-key": env.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.anthropicModel,
        max_tokens: 300,
        system:
          "Eres el asistente de inventario de una pequeña tienda en El Salvador. Responde en español, " +
          "en máximo 3 frases, sin inventar datos: usa solo la lista que recibes.",
        messages: [
          {
            role: "user",
            content: `Resume qué reponer primero y por qué. Datos (JSON): ${JSON.stringify(sugerencias.slice(0, 15))}`,
          },
        ],
      }),
    });
    if (!res.ok) return respaldo;
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const texto = json.content?.find((c) => c.type === "text")?.text?.trim();
    return texto ? { resumen: texto, fuente: "ia" } : respaldo;
  } catch {
    return respaldo;
  }
}

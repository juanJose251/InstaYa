// POST /.netlify/functions/wompi-webhook — Wompi avisa cada pago aprobado.
// Se valida que sea auténtico, se extiende la licencia un mes y se firma una clave nueva.
import { extender, firmarLicencia, json, licencias, transaccionAprobada, webhookValido } from "../../lib/comun.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const cuerpo = await req.text();
  let pago;
  try {
    pago = JSON.parse(cuerpo);
  } catch {
    return json({ error: "Cuerpo inválido" }, 400);
  }

  const hash = req.headers.get("wompi_hash");
  const autentico = hash ? webhookValido(cuerpo, hash) : await transaccionAprobada(pago.IdTransaccion, pago.Monto);
  if (!autentico) return json({ error: "Webhook no verificado" }, 401);

  if (pago.ResultadoTransaccion !== "ExitosaAprobada") return json({ ok: true, ignorado: "no aprobada" });
  if (pago.EsProductiva === false && process.env.WOMPI_PRUEBAS !== "1") return json({ ok: true, ignorado: "pago de prueba" });

  const store = licencias();
  // Cada transacción vale una sola vez, para cualquier licencia (Wompi puede reintentar el aviso).
  const usada = `tx-${pago.IdTransaccion}`;
  if (await store.get(usada)) return json({ ok: true, repetido: true });

  const lic = String(pago.EnlacePago?.IdentificadorEnlaceComercio || "").split(":")[0];
  const registro = lic && (await store.get(lic, { type: "json" }));
  if (!registro) return json({ ok: true, ignorado: "licencia desconocida" });

  // $10 por mes: si algún día se cobran varios meses juntos, se suman.
  const meses = Math.max(1, Math.round(Number(pago.Monto) / 10));
  registro.vence = extender(registro.vence, meses);
  registro.clave = firmarLicencia(registro);
  registro.pagos.push({ id: pago.IdTransaccion, monto: pago.Monto, fecha: pago.FechaTransaccion, prueba: pago.EsProductiva === false });
  await store.setJSON(lic, registro);
  await store.set(usada, lic);
  return json({ ok: true, vence: registro.vence });
};

// GET /.netlify/functions/licencia?lic=ID — estado y última clave firmada.
// La usan la página de gracias (espera a que llegue el pago) y la app instalada (renovación automática).
import { json, licencias } from "../../lib/comun.mjs";

export default async (req) => {
  const lic = new URL(req.url).searchParams.get("lic");
  if (!lic) return json({ error: "Falta lic" }, 400);
  const r = await licencias().get(lic, { type: "json" });
  if (!r) return json({ error: "Licencia no encontrada" }, 404);
  const estado = !r.vence ? "pendiente" : new Date(r.vence) > new Date() ? "activa" : "vencida";
  return json({ lic: r.lic, negocio: r.negocio, estado, vence: r.vence, clave: r.clave });
};

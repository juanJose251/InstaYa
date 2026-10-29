/**
 * Código compartido por las funciones de la tienda de licencias (Netlify Functions + Netlify Blobs).
 *
 * Variables de entorno (Netlify → Project configuration → Environment variables):
 *   LICENCIA_PRIVADA   llave privada Ed25519 (PEM) con la que se firman las claves. Nunca va a git.
 *   WOMPI_APP_ID       App ID del aplicativo en panel.wompi.sv (client_id)
 *   WOMPI_API_SECRET   API Secret del aplicativo (client_secret y llave del HMAC de los webhooks)
 *   SITIO_URL          URL pública de la tienda, p. ej. https://instaya-app.netlify.app
 *   WOMPI_PRUEBAS=1    acepta pagos del modo desarrollo de Wompi (EsProductiva=false). Quitar al cobrar de verdad.
 *   AVISAR_EMAIL       opcional: correo que recibe aviso de Wompi por cada pago
 *   WOMPI_ID_URL, WOMPI_API_URL   opcionales, solo para pruebas con un Wompi simulado
 */
import { createHmac, createPrivateKey, randomBytes, sign, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

export const PRECIO_MENSUAL = 10;
const ID_URL = process.env.WOMPI_ID_URL || "https://id.wompi.sv";
const API_URL = process.env.WOMPI_API_URL || "https://api.wompi.sv";

export const sitio = () => (process.env.SITIO_URL || "").replace(/\/$/, "");
export const licencias = () => getStore({ name: "licencias", consistency: "strong" });

export const json = (datos, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

/** Id corto y difícil de adivinar: identifica la licencia para renovarla. */
export const nuevoId = () => randomBytes(9).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X");

/** Misma regla que backend/src/lib/suscripcion.ts (extenderSuscripcion): pagar antes no hace perder días. */
export function extender(venceActual, meses = 1, ahora = new Date()) {
  const base = venceActual && new Date(venceActual) > ahora ? new Date(venceActual) : new Date(ahora);
  base.setMonth(base.getMonth() + meses);
  return base.toISOString();
}

/** Clave = base64url(contenido).base64url(firma Ed25519). La app la verifica con la llave pública. */
export function firmarLicencia({ lic, negocio, email, vence }) {
  const llave = createPrivateKey((process.env.LICENCIA_PRIVADA || "").replace(/\\n/g, "\n"));
  const datos = Buffer.from(JSON.stringify({ v: 1, lic, negocio, email, vence }));
  return `${datos.toString("base64url")}.${sign(null, datos, llave).toString("base64url")}`;
}

/** Webhook auténtico: HMAC-SHA256 del body tal cual llega, con el API Secret (docs.wompi.sv → Validar Webhook). */
export function webhookValido(cuerpo, hash) {
  if (!hash || !process.env.WOMPI_API_SECRET) return false;
  const mac = createHmac("sha256", process.env.WOMPI_API_SECRET).update(cuerpo, "utf8").digest();
  const recibido = /^[0-9a-f]+$/i.test(hash) ? Buffer.from(hash, "hex") : Buffer.from(hash, "base64");
  return recibido.length === mac.length && timingSafeEqual(recibido, mac);
}

async function tokenWompi() {
  const res = await fetch(`${ID_URL}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      audience: "wompi_api",
      client_id: process.env.WOMPI_APP_ID || "",
      client_secret: process.env.WOMPI_API_SECRET || "",
    }),
  });
  if (!res.ok) throw new Error(`Wompi token ${res.status}`);
  return (await res.json()).access_token;
}

/** Respaldo si el header wompi_hash no llega (algunos proxies descartan headers con "_"): se consulta a Wompi. */
export async function transaccionAprobada(id, monto) {
  if (!id) return false;
  const res = await fetch(`${API_URL}/TransaccionCompra/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${await tokenWompi()}` },
  });
  if (!res.ok) return false;
  const t = await res.json();
  return t.esAprobada === true && (t.monto === undefined || Number(t.monto) === Number(monto));
}

/** Crea un enlace de pago de un solo uso por $10 para esta licencia y devuelve su URL. */
export async function crearEnlacePago({ lic, negocio }) {
  const res = await fetch(`${API_URL}/EnlacePago`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await tokenWompi()}` },
    body: JSON.stringify({
      identificadorEnlaceComercio: `${lic}:${Date.now()}`,
      monto: PRECIO_MENSUAL,
      nombreProducto: "InstaYa! — Licencia mensual",
      formaPago: {
        permitirTarjetaCreditoDebido: true,
        permitirPagoConPuntoAgricola: false,
        permitirPagoEnCuotasAgricola: false,
        permitirPagoEnBitcoin: false,
        permitePagoQuickPay: false,
      },
      infoProducto: { descripcionProducto: `Un mes del plan Básico de InstaYa! para ${negocio}. Usuarios ilimitados, soporte y actualizaciones.` },
      configuracion: {
        urlRedirect: `${sitio()}/gracias?lic=${lic}`,
        urlWebhook: `${sitio()}/.netlify/functions/wompi-webhook`,
        notificarTransaccionCliente: true,
        esMontoEditable: false,
        ...(process.env.AVISAR_EMAIL ? { emailsNotificacion: process.env.AVISAR_EMAIL } : {}),
      },
      limitesDeUso: { cantidadMaximaPagosExitosos: 1, cantidadMaximaPagosFallidos: 5 },
    }),
  });
  if (!res.ok) throw new Error(`Wompi EnlacePago ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).urlEnlace;
}

// POST /.netlify/functions/comprar  { negocio, email }  → nueva licencia
//                                   { lic }              → renovar una existente
// Devuelve { lic, url }: la URL del enlace de pago de Wompi ($10, un mes).
import { crearEnlacePago, json, licencias, nuevoId, sitio } from "../../lib/comun.mjs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!process.env.WOMPI_APP_ID || !process.env.WOMPI_API_SECRET || !sitio()) {
    return json({ error: "Los pagos todavía no están configurados. Escríbenos para activar tu licencia." }, 503);
  }
  let datos;
  try {
    datos = await req.json();
  } catch {
    return json({ error: "Datos inválidos" }, 400);
  }

  const store = licencias();
  let registro;
  if (datos.lic) {
    registro = await store.get(String(datos.lic), { type: "json" });
    if (!registro) return json({ error: "No encontramos esa licencia. Revisa el código o escríbenos." }, 404);
  } else {
    const negocio = String(datos.negocio || "").trim().slice(0, 120);
    const email = String(datos.email || "").trim().toLowerCase().slice(0, 200);
    if (negocio.length < 2) return json({ error: "Escribe el nombre de tu negocio" }, 400);
    if (!EMAIL.test(email)) return json({ error: "Escribe un correo válido" }, 400);
    registro = { lic: nuevoId(), negocio, email, vence: null, clave: null, pagos: [], creada: new Date().toISOString() };
    await store.setJSON(registro.lic, registro);
  }

  try {
    return json({ lic: registro.lic, url: await crearEnlacePago(registro) });
  } catch (e) {
    console.error(e);
    return json({ error: "No pudimos conectar con Wompi. Intenta de nuevo en unos minutos." }, 502);
  }
};

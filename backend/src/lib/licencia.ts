import { createPublicKey, verify, type KeyObject } from "node:crypto";

/**
 * Licencias de la instalación local ($10 al mes, se compran en la tienda con Wompi).
 *
 * Una clave es `base64url(JSON del contenido).base64url(firma Ed25519)`. La firma la hace la tienda
 * (función de Netlify) con la llave privada; aquí solo vive la pública, así que nadie puede fabricar
 * ni alargar una clave. Se verifica sin internet: la app sigue funcionando hasta `vence`.
 */
export const LLAVE_PUBLICA = createPublicKey(`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAaTPB27PHSv5iNlAgWmYdRnlHuhYEzwU7Q526CaKtadA=
-----END PUBLIC KEY-----`);

export interface Licencia {
  v: 1;
  lic: string; // id de la licencia en la tienda (se usa para renovar)
  negocio: string;
  email: string;
  vence: string; // ISO
}

/** Devuelve el contenido si la firma es válida; `null` si la clave está mal copiada, alterada o es de otra llave. */
export function leerLicencia(clave: string, llave: KeyObject = LLAVE_PUBLICA): Licencia | null {
  const partes = clave.trim().split(".");
  if (partes.length !== 2) return null;
  try {
    const datos = Buffer.from(partes[0], "base64url");
    if (!verify(null, datos, llave, Buffer.from(partes[1], "base64url"))) return null;
    const lic = JSON.parse(datos.toString("utf8")) as Licencia;
    if (lic.v !== 1 || !lic.lic || Number.isNaN(Date.parse(lic.vence))) return null;
    return lic;
  } catch {
    return null;
  }
}

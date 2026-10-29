/**
 * Variantes de compilación del mismo frontend:
 * - VITE_TIENDA=true  sitio público de venta: landing con descarga y compra de licencias (instaya-app.netlify.app)
 * - VITE_LOCAL=true   app instalada con el instalador de Windows: "/" va directo al panel
 * Sin ninguna, es la app normal (o la demo con VITE_DEMO).
 */
export const TIENDA = import.meta.env.VITE_TIENDA === "true";
export const LOCAL = import.meta.env.VITE_LOCAL === "true";

/** Instalador para Windows (último release de GitHub). */
export const DESCARGA_URL =
  import.meta.env.VITE_DESCARGA_URL ?? "https://github.com/juanJose251/InstaYa/releases/latest/download/InstaYa-Setup.exe";

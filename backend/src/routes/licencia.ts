import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error";
import { env } from "../config/env";
import { leerLicencia } from "../lib/licencia";
import { calcularSuscripcion } from "../lib/suscripcion";

const router = Router();

/** Aplica una clave válida y vigente a la empresa: plan BASICO hasta la fecha de la licencia. */
async function aplicarClave(empresaId: string, clave: string) {
  const lic = leerLicencia(clave);
  if (!lic) throw new AppError(400, "La clave no es válida. Cópiala completa desde el correo o la página de compra.");
  if (Date.parse(lic.vence) <= Date.now()) throw new AppError(400, "Esta clave ya venció. Renueva tu licencia en la tienda.");
  const empresa = await prisma.empresa.update({
    where: { id: empresaId },
    data: { plan: "BASICO", suscripcionFin: new Date(lic.vence), licencia: clave.trim() },
    select: { plan: true, trialFin: true, suscripcionFin: true },
  });
  return { licencia: lic, suscripcion: calcularSuscripcion(empresa) };
}

/**
 * Pide a la tienda la clave más reciente de la licencia (después de cada pago la tienda firma una nueva
 * con el vencimiento extendido). Sin internet o sin cambios no hace nada.
 */
export async function sincronizarLicencia(empresaId: string, claveActual: string): Promise<boolean> {
  const actual = leerLicencia(claveActual);
  if (!env.tiendaUrl || !actual) return false;
  try {
    const res = await fetch(`${env.tiendaUrl}/.netlify/functions/licencia?lic=${encodeURIComponent(actual.lic)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    const { clave } = (await res.json()) as { clave?: string };
    const nueva = clave ? leerLicencia(clave) : null;
    if (!clave || !nueva || nueva.lic !== actual.lic || Date.parse(nueva.vence) <= Date.parse(actual.vence)) return false;
    await aplicarClave(empresaId, clave);
    return true;
  } catch {
    return false; // sin internet: se sigue con la clave guardada hasta que venza
  }
}

/** Revisa todas las empresas con licencia (lo llama server.ts al arrancar y cada pocas horas). */
export async function sincronizarLicencias() {
  const empresas = await prisma.empresa.findMany({ where: { licencia: { not: null } }, select: { id: true, licencia: true } });
  for (const e of empresas) await sincronizarLicencia(e.id, e.licencia!);
}

router.use(authenticate);

// GET /api/licencia — licencia actual y dónde comprar o renovar
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const empresa = await prisma.empresa.findFirst({ where: { id: req.user!.empresaId }, select: { licencia: true } });
    const lic = empresa?.licencia ? leerLicencia(empresa.licencia) : null;
    res.json({
      licencia: lic ? { lic: lic.lic, negocio: lic.negocio, email: lic.email, vence: lic.vence } : null,
      tienda: env.tiendaUrl || null,
    });
  })
);

const claveSchema = z.object({ clave: z.string().min(20, "Pega la clave completa") });

// POST /api/licencia — activar con la clave que se recibió al comprar
router.post(
  "/",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { clave } = claveSchema.parse(req.body);
    res.json(await aplicarClave(req.user!.empresaId, clave));
  })
);

// POST /api/licencia/sincronizar — "ya pagué": trae de la tienda la clave renovada
router.post(
  "/sincronizar",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const empresa = await prisma.empresa.findFirst({ where: { id: req.user!.empresaId }, select: { licencia: true } });
    if (!empresa?.licencia) throw new AppError(400, "Primero activa tu licencia con la clave de compra.");
    const renovada = await sincronizarLicencia(req.user!.empresaId, empresa.licencia);
    res.json({ renovada, suscripcion: req.suscripcion });
  })
);

export default router;

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { tenantGuard } from "../middleware/tenant";
import { AppError } from "../middleware/error";
import { Role } from "@prisma/client";

const router = Router();

router.use(authenticate);

// GET /api/usuarios/me — perfil del usuario autenticado, su empresa y el estado del plan
// (el front lo usa al recargar la página para no perder el nombre de la empresa ni el aviso del plan)
router.get(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    const empresa = await prisma.empresa.findFirst({
      where: { id: req.user!.empresaId },
      select: { id: true, nombre: true, giro: true, direccion: true, telefono: true, trialFin: true, plan: true, suscripcionFin: true },
    });
    res.json({ usuario: req.user, empresa: empresa ?? null, suscripcion: req.suscripcion });
  })
);

// GET /api/usuarios — listar usuarios de MI empresa (multi-tenant)
router.get(
  "/",
  tenantGuard,
  asyncHandler(async (req, res) => {
    const usuarios = await prisma.usuario.findMany({
      where: { empresaId: req.user!.empresaId },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ usuarios });
  })
);

const createUserSchema = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  rol: z.enum(["ADMIN", "EMPLEADO"]).default("EMPLEADO"),
});

// POST /api/usuarios — crear empleado (solo ADMIN)
router.post(
  "/",
  tenantGuard,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.parse(req.body);
    const { empresaId } = req.user!;

    const existe = await prisma.usuario.findFirst({
      where: { empresaId, email: parsed.email.toLowerCase() },
    });
    if (existe) {
      throw new AppError(409, "Ese correo ya pertenece a un usuario de la empresa");
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const usuario = await prisma.usuario.create({
      data: {
        empresaId,
        nombre: parsed.nombre,
        email: parsed.email.toLowerCase(),
        passwordHash,
        rol: parsed.rol,
      },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
    });

    res.status(201).json({ usuario });
  })
);

const updateUserSchema = z
  .object({
    nombre: z.string().min(2, "Nombre requerido").optional(),
    rol: z.enum(["ADMIN", "EMPLEADO"]).optional(),
    activo: z.boolean().optional(),
    password: z.string().min(6, "Mínimo 6 caracteres").optional(),
  })
  .strict();

// PUT /api/usuarios/:id — cambiar rol, desactivar/reactivar o restablecer contraseña (solo ADMIN, solo de MI empresa)
router.put(
  "/:id",
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = updateUserSchema.parse(req.body);
    const { empresaId, id: yo } = req.user!;
    const usuario = await prisma.usuario.findFirst({ where: { id: req.params.id, empresaId } });
    if (!usuario) throw new AppError(404, "Usuario no encontrado");
    // Evita que la empresa se quede sin administrador por error
    if (usuario.id === yo && (data.activo === false || data.rol === "EMPLEADO")) {
      throw new AppError(400, "No puedes desactivarte ni quitarte el rol de administrador a ti mismo");
    }
    const { password, ...resto } = data;
    const actualizado = await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ...resto, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
    });
    res.json({ usuario: actualizado });
  })
);

export default router;

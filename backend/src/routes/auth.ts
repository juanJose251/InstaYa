import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { signToken } from "../middleware/auth";
import { AppError } from "../middleware/error";

const router = Router();

const registerSchema = z.object({
  empresa: z.object({
    nombre: z.string().min(2, "Nombre de empresa requerido"),
    giro: z.string().optional(),
    direccion: z.string().optional(),
    telefono: z.string().optional(),
  }),
  admin: z.object({
    nombre: z.string().min(2, "Nombre requerido"),
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  }),
});

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

// POST /api/auth/register — crea una empresa + su usuario ADMIN (trial 15 días)
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.parse(req.body);
    const { empresa, admin } = parsed;

    const emailExists = await prisma.usuario.findFirst({ where: { email: admin.email } });
    if (emailExists) {
      throw new AppError(409, "El correo ya está registrado");
    }

    const passwordHash = await bcrypt.hash(admin.password, 10);
    const trialFin = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // +15 días

    const empresaCreada = await prisma.empresa.create({
      data: {
        nombre: empresa.nombre,
        giro: empresa.giro,
        direccion: empresa.direccion,
        telefono: empresa.telefono,
        trialFin,
        usuarios: {
          create: {
            nombre: admin.nombre,
            email: admin.email.toLowerCase(),
            passwordHash,
            rol: "ADMIN",
          },
        },
      },
      include: { usuarios: true },
    });

    const adminUser = empresaCreada.usuarios[0];
    const token = signToken({
      id: adminUser.id,
      empresaId: adminUser.empresaId,
      email: adminUser.email,
      nombre: adminUser.nombre,
      rol: adminUser.rol,
    });

    res.status(201).json({
      token,
      usuario: {
        id: adminUser.id,
        nombre: adminUser.nombre,
        email: adminUser.email,
        rol: adminUser.rol,
      },
      empresa: {
        id: empresaCreada.id,
        nombre: empresaCreada.nombre,
        trialFin: empresaCreada.trialFin,
      },
    });
  })
);

// POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.parse(req.body);
    const email = parsed.email.toLowerCase();

    const usuario = await prisma.usuario.findFirst({
      where: { email },
      include: { empresa: true },
    });

    if (!usuario) {
      throw new AppError(401, "Credenciales inválidas");
    }
    if (!usuario.activo) {
      throw new AppError(403, "Usuario desactivado");
    }
    if (!usuario.empresa.activa) {
      throw new AppError(403, "La empresa está inactiva");
    }

    const valida = await bcrypt.compare(parsed.password, usuario.passwordHash);
    if (!valida) {
      throw new AppError(401, "Credenciales inválidas");
    }

    const token = signToken({
      id: usuario.id,
      empresaId: usuario.empresaId,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
    });

    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
      empresa: { id: usuario.empresa.id, nombre: usuario.empresa.nombre, trialFin: usuario.empresa.trialFin },
    });
  })
);

export default router;
import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { tenantGuard } from "../middleware/tenant";
import { AppError } from "../middleware/error";
import { Role } from "@prisma/client";

const router = Router();

router.use(authenticate);

// GET /api/usuarios/me — perfil del usuario autenticado
router.get("/me", (req: Request, res: Response) => {
  res.json({ usuario: req.user });
});

// GET /api/usuarios — listar usuarios de MI empresa (multi-tenant)
router.get("/", tenantGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { empresaId: req.user!.empresaId },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ usuarios });
  } catch (err) {
    next(err);
  }
});

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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new AppError(400, err.errors[0].message));
      }
      next(err);
    }
  }
);

export default router;
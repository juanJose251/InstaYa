import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./error";
import prisma from "../lib/prisma";
import { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  empresaId: string;
  email: string;
  nombre: string;
  rol: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: { id: string; empresaId: string; email: string; nombre: string; rol: Role }): string {
  return jwt.sign(
    { sub: user.id, empresaId: user.empresaId, email: user.email, nombre: user.nombre, rol: user.rol },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] }
  );
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Token no proporcionado"));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    const usuario = await prisma.usuario.findFirst({
      where: { id: payload.sub as string, activo: true },
      select: { id: true, empresaId: true, email: true, nombre: true, rol: true, empresa: { select: { activa: true } } },
    });

    if (!usuario || !usuario.empresa.activa) {
      return next(new AppError(401, "Usuario no válido o empresa inactiva"));
    }

    req.user = {
      id: usuario.id,
      empresaId: usuario.empresaId,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
    };
    next();
  } catch {
    return next(new AppError(401, "Token inválido o expirado"));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, "No autenticado"));
    }
    if (!roles.includes(req.user.rol)) {
      return next(new AppError(403, "No tienes permisos para esta acción"));
    }
    next();
  };
}
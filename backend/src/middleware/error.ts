import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

/**
 * Único lugar donde se traducen errores a respuestas HTTP:
 * - AppError: el código y mensaje que definimos nosotros
 * - ZodError: validación de entrada -> 400 con el primer mensaje
 * - Prisma P2002: violación de unicidad (p. ej. SKU repetido) -> 409
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: err.errors[0].message });
    return;
  }

  if ((err as { code?: string })?.code === "P2002") {
    res.status(409).json({ error: "Ya existe un registro con ese valor único (por ejemplo, el SKU)" });
    return;
  }

  console.error("Error no controlado:", err);
  res.status(500).json({ error: "Error interno del servidor" });
};

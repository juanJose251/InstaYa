import { Request, Response, NextFunction } from "express";

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

  console.error("Error no controlado:", err);
  res.status(500).json({ error: "Error interno del servidor" });
};
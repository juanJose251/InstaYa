import { Request, Response, NextFunction } from "express";
import { AppError } from "./error";

/**
 * Aislamiento multi-tenant.
 * Fuerza que toda consulta use la empresa del usuario autenticado,
 * impidiendo acceso cruzado entre PYMES.
 *
 * Uso en queries: `{ ...where, empresaId: req.tenantId }`
 */
export function tenantGuard(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, "No autenticado"));
  }

  // Si el cuerpo pide una empresaId distinta a la del usuario, se rechaza
  if (req.body && typeof req.body === "object" && "empresaId" in req.body) {
    const solicitada = (req.body as { empresaId?: string }).empresaId;
    if (solicitada && solicitada !== req.user.empresaId) {
      return next(new AppError(403, "No puedes operar sobre otra empresa"));
    }
  }

  req.body = { ...req.body, empresaId: req.user.empresaId };
  next();
}
import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Envuelve un handler async para que cualquier error (throw o promesa rechazada)
 * llegue al middleware de errores. Evita repetir try/catch en cada ruta.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

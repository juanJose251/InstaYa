import rateLimit from "express-rate-limit";

/** Frena la fuerza bruta sobre login/registro: 20 intentos por IP cada 15 minutos. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Inténtalo de nuevo en unos minutos." },
  // Las suites de Supertest hacen muchas peticiones de login desde la misma IP.
  skip: () => process.env.NODE_ENV === "test",
});

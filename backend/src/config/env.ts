import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "cambia-este-secreto-en-produccion",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  // Opcional: sin clave, el asistente de reposición responde solo con reglas (sin IA).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // Clave del operador de la plataforma (dueño del SaaS) para activar planes tras confirmar el pago.
  // Vacía = las rutas /api/plataforma quedan desactivadas.
  platformKey: process.env.PLATFORM_KEY ?? "",
  soporteContacto: process.env.SOPORTE_CONTACTO ?? "soporte@instaya.app",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5",
};

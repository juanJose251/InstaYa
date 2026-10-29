import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/error";
import authRoutes from "./routes/auth";
import usuarioRoutes from "./routes/usuarios";
import productoRoutes from "./routes/productos";
import movimientoRoutes from "./routes/movimientos";
import ventaRoutes from "./routes/ventas";
import reporteRoutes from "./routes/reportes";
import categoriaRoutes from "./routes/categorias";
import proveedorRoutes from "./routes/proveedores";
import asistenteRoutes from "./routes/asistente";
import suscripcionRoutes from "./routes/suscripcion";
import empresaRoutes from "./routes/empresa";
import plataformaRoutes from "./routes/plataforma";
import { authLimiter } from "./middleware/rateLimit";
import { docsRouter } from "./docs/openapi";

// La app se separa de server.ts para poder probarla con Supertest sin abrir un puerto.
const app = express();

// Detrás de un proxy (Docker, nginx, AWS) la IP real viene en X-Forwarded-For; el rate limit la necesita.
app.set("trust proxy", 1);

// En la instalación local se sirve por http://localhost: sin upgrade-insecure-requests, que forzaría https.
app.use(env.staticDir ? helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }) : helmet());
app.use(cors({ origin: env.clientUrl }));
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", servicio: "InstaYa! API", timestamp: new Date().toISOString() });
});

// Rutas
app.use("/api/docs", docsRouter);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/productos", productoRoutes);
app.use("/api/movimientos", movimientoRoutes);
app.use("/api/ventas", ventaRoutes);
app.use("/api/reportes", reporteRoutes);
app.use("/api/categorias", categoriaRoutes);
app.use("/api/proveedores", proveedorRoutes);
app.use("/api/asistente", asistenteRoutes);
app.use("/api/suscripcion", suscripcionRoutes);
app.use("/api/empresa", empresaRoutes);
app.use("/api/plataforma", authLimiter, plataformaRoutes);

// Instalación local: la misma API sirve la web (SPA). Cualquier ruta que no sea /api devuelve index.html.
if (env.staticDir) {
  app.use(express.static(env.staticDir, { index: false }));
  app.get(/^\/(?!api(\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(env.staticDir, "index.html"));
  });
}

// 404 y errores
app.use(notFound);
app.use(errorHandler);

export default app;

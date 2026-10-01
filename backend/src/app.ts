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

// La app se separa de server.ts para poder probarla con Supertest sin abrir un puerto.
const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl }));
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", servicio: "InstaYa! API", timestamp: new Date().toISOString() });
});

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/productos", productoRoutes);
app.use("/api/movimientos", movimientoRoutes);
app.use("/api/ventas", ventaRoutes);
app.use("/api/reportes", reporteRoutes);

// 404 y errores
app.use(notFound);
app.use(errorHandler);

export default app;

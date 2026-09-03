import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/error";
import authRoutes from "./routes/auth";
import usuarioRoutes from "./routes/usuarios";

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

// 404 y errores
app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`InstaYa! API corriendo en http://localhost:${env.port}`);
});
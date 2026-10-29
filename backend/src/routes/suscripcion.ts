import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate } from "../middleware/auth";
import { env } from "../config/env";
import { PRECIOS, calcularSuscripcion } from "../lib/suscripcion";

const router = Router();
router.use(authenticate);

// GET /api/suscripcion — estado del plan de MI empresa, precios y cómo pagar
router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({
      suscripcion: req.suscripcion ?? calcularSuscripcion({}),
      precios: PRECIOS,
      pago: {
        metodos: ["Transferencia bancaria", "Wompi", "N1co"],
        contacto: env.soporteContacto,
        instrucciones:
          "Paga la implementación ($50, una sola vez) y la mensualidad ($10) y envía el comprobante con el nombre de tu empresa. Activamos tu plan el mismo día.",
      },
    });
  })
);

export default router;

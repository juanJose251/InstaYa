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
      // Con tienda (instalación local): se paga con tarjeta en línea y la licencia se activa con una clave.
      pago: env.tiendaUrl
        ? {
            metodos: ["Tarjeta de crédito o débito (Wompi)"],
            contacto: env.soporteContacto,
            tienda: env.tiendaUrl,
            instrucciones:
              "Compra tu licencia ($10 al mes) con tarjeta en la tienda y pega aquí la clave que recibes. Cada mes que pagues, la app se renueva sola cuando tenga internet.",
          }
        : {
            metodos: ["Transferencia bancaria", "Wompi", "N1co"],
            contacto: env.soporteContacto,
            tienda: null,
            instrucciones:
              "Paga la implementación ($50, una sola vez) y la mensualidad ($10) y envía el comprobante con el nombre de tu empresa. Activamos tu plan el mismo día.",
          },
    });
  })
);

export default router;

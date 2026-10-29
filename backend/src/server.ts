import app from "./app";
import { env } from "./config/env";
import { sincronizarLicencias } from "./routes/licencia";

app.listen(env.port, () => {
  console.log(`InstaYa! API corriendo en http://localhost:${env.port}`);
});

// Instalación local con licencia: trae de la tienda las renovaciones pagadas (al arrancar y cada 6 horas).
if (env.tiendaUrl) {
  const sincronizar = () => sincronizarLicencias().catch((e) => console.error("Licencias:", e));
  sincronizar();
  setInterval(sincronizar, 6 * 60 * 60 * 1000).unref();
}

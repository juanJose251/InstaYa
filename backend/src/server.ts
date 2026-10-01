import app from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`InstaYa! API corriendo en http://localhost:${env.port}`);
});

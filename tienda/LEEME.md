# Tienda de licencias de InstaYa!

Sitio de venta del instalador local: **15 días gratis** con la descarga y luego **$10 al mes** con tarjeta (Wompi El Salvador).

## Flujo

1. **Landing** (`/`, compilada con `VITE_TIENDA=true`): el cliente ve dos planes, **Prueba gratis** (descarga del `.exe`) y **Plan Básico $10/mes**.
2. **`/comprar`**: el cliente pone su negocio y su correo. La función `comprar` crea la licencia en Netlify Blobs y un enlace de pago de Wompi de un solo uso ($10), y lo manda a pagar.
3. **Webhook:** Wompi avisa a `wompi-webhook`. La función:
   - verifica el HMAC `wompi_hash`; si ese header no llega, consulta `/TransaccionCompra/{id}`
   - extiende la licencia un mes
   - firma una clave nueva con Ed25519
4. **`/gracias?lic=…`**: espera a que llegue el aviso y muestra la clave y el botón de descarga.
5. **En la app instalada:** Plan → pegar clave → **Activar**. Al renovar (`/comprar?lic=…`), la app trae la clave nueva sola (al arrancar, cada 6 h o con **Ya pagué: actualizar**).

La llave privada que firma las claves está en `../.claves/licencia-privada.pem`, que **nunca va a git**. La pública está en `backend/src/lib/licencia.ts`.
⚠️ Si se pierde la privada, hay que generar otra y sacar un instalador nuevo. **Respáldala.**

## Variables en Netlify (proyecto `instaya-app`)

| Variable | Valor |
|---|---|
| `LICENCIA_PRIVADA` | contenido de `.claves/licencia-privada.pem` |
| `WOMPI_APP_ID` | App ID del aplicativo (panel.wompi.sv) |
| `WOMPI_API_SECRET` | API Secret del aplicativo |
| `SITIO_URL` | `https://instaya-app.netlify.app` |
| `WOMPI_PRUEBAS` | `1` mientras el negocio de Wompi esté en modo desarrollo; **borrarla al cobrar de verdad** |
| `AVISAR_EMAIL` | opcional: tu correo, para que Wompi te avise de cada pago |

## Publicar

```bash
cd frontend && VITE_DEMO=true VITE_TIENDA=true npx vite build --outDir ../tienda/dist --emptyOutDir
cd ../tienda && npm install && npx netlify-cli deploy --prod --dir dist --site instaya-app
```

Descarga: `https://github.com/juanJose251/InstaYa/releases/latest/download/InstaYa-Setup.exe` (subir `local/salida/InstaYa-Setup.exe` a un release).

## Probar sin Wompi real

Con `WOMPI_ID_URL` y `WOMPI_API_URL` apuntando a un simulador local se probó el ciclo completo:
- compra, webhook firmado, clave y activación en la app
- renovación con "Ya pagué"
- rechazo de webhooks falsos y de webhooks repetidos

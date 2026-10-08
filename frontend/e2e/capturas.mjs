// Genera las capturas del README: `VITE_DEMO=true npm run dev -- --port 5199` y luego `node e2e/capturas.mjs`
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const out = "../docs/screenshots";

await page.goto("http://localhost:5199/login");
await page.getByRole("button", { name: "Entrar" }).click();
await page.getByText("Hola,").waitFor();
await page.getByTestId("asistente-resumen").waitFor();
await page.screenshot({ path: `${out}/dashboard.png` });

await page.goto("http://localhost:5199/app/ventas");
await page.getByRole("button", { name: "+ Venta" }).click();
await page.getByLabel("Producto").selectOption({ label: "Arroz 5 lb ($3.50 · 40 u.)" });
await page.getByLabel("Cantidad").fill("2");
await page.getByRole("button", { name: "Agregar" }).click();
await page.getByLabel("Producto").selectOption({ label: "Huevos (docena) ($3.00 · 20 u.)" });
await page.getByRole("button", { name: "Agregar" }).click();
await page.screenshot({ path: `${out}/ventas.png` });

await page.goto("http://localhost:5199/app/reportes");
await page.getByRole("button", { name: "Mes" }).click();
await page.getByTestId("top-productos").waitFor();
await page.waitForTimeout(400); // deja terminar la transición CSS del botón activo
await page.screenshot({ path: `${out}/reportes.png` });

await page.goto("http://localhost:5199/app/catalogo");
await page.getByText("Granos").waitFor();
await page.screenshot({ path: `${out}/catalogo.png` });

await browser.close();

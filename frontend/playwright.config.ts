import { defineConfig } from "@playwright/test";

// E2E sobre la demo (VITE_DEMO=true): no necesita backend ni base de datos.
// En CI se instala Chromium; en local puedes usar tu Chrome con PW_CHANNEL=chrome.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5199",
    channel: process.env.PW_CHANNEL || undefined,
    trace: "retain-on-failure",
    viewport: { width: 390, height: 844 }, // móvil: la app es mobile-first
  },
  webServer: {
    command: "npm run dev -- --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: !process.env.CI,
    env: { VITE_DEMO: "true" },
    timeout: 60_000,
  },
});

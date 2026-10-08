import { test, expect, Page } from "@playwright/test";

async function entrar(page: Page) {
  await page.goto("/login");
  // en modo demo el formulario ya viene con la cuenta demo
  await page.getByRole("button", { name: /entrar|iniciar/i }).click();
  await expect(page.getByText("Hola,")).toBeVisible();
}

test("login demo muestra el dashboard con datos reales y el asistente de reposición", async ({ page }) => {
  await entrar(page);
  await expect(page.getByTestId("kpi-productos")).toHaveText("8");
  await expect(page.getByTestId("asistente-resumen")).toContainText("necesitan reposición");
});

test("rutas protegidas redirigen al login sin sesión", async ({ page }) => {
  await page.goto("/app/ventas");
  await expect(page).toHaveURL(/\/login/);
});

test("venta con productos: calcula el total, descuenta stock y se puede anular", async ({ page }) => {
  await entrar(page);
  await page.goto("/app/ventas");
  await page.getByRole("button", { name: "+ Venta" }).click();

  await page.getByLabel("Producto").selectOption({ label: "Arroz 5 lb ($3.50 · 40 u.)" });
  await page.getByLabel("Cantidad").fill("2");
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByTestId("total-estimado")).toHaveText("$7.00");

  await page.getByLabel("Cliente (opcional)").fill("Cliente E2E");
  await page.getByRole("button", { name: "Registrar venta" }).click();
  const tarjeta = page.locator("div", { hasText: "Cliente E2E" }).filter({ hasText: "2 × Arroz 5 lb" }).last();
  await expect(tarjeta).toBeVisible();

  // el stock bajó de 40 a 38
  await page.goto("/app/productos");
  await expect(page.getByText("38 u.")).toBeVisible();

  // anular repone el stock
  await page.goto("/app/ventas");
  page.once("dialog", (d) => d.accept());
  await page.getByText("Anular venta").first().click();
  await expect(page.getByText("Anulada").first()).toBeVisible();
  await page.goto("/app/productos");
  await expect(page.getByText("40 u.")).toBeVisible();
});

test("no deja vender más que el stock disponible", async ({ page }) => {
  await entrar(page);
  await page.goto("/app/ventas");
  await page.getByRole("button", { name: "+ Venta" }).click();
  await page.getByLabel("Producto").selectOption({ label: "Leche 1 L ($1.35 · 4 u.)" });
  await page.getByLabel("Cantidad").fill("5");
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByText(/Stock insuficiente de "Leche 1 L"/)).toBeVisible();
});

test("catálogo: crear categoría y usarla en un producto nuevo", async ({ page }) => {
  await entrar(page);
  await page.goto("/app/catalogo");
  await page.getByLabel("Nueva categoría").fill("Snacks");
  await page.getByRole("button", { name: "Agregar categoría" }).click();
  await expect(page.getByText("Snacks")).toBeVisible();

  await page.goto("/app/productos");
  await page.getByRole("button", { name: "+ Nuevo" }).click();
  await page.getByLabel("Nombre *").fill("Papas fritas");
  await page.getByLabel("Precio compra ($)").fill("0.5");
  await page.getByLabel("Precio venta ($)").fill("1");
  await page.getByLabel("Categoría").selectOption({ label: "Snacks" });
  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(page.getByText("Papas fritas")).toBeVisible();
  await expect(page.getByText(/· Snacks/)).toBeVisible();
});

test("reportes muestra el top de productos más vendidos", async ({ page }) => {
  await entrar(page);
  await page.goto("/app/reportes");
  await page.getByRole("button", { name: "Mes" }).click();
  await expect(page.getByTestId("top-productos").locator("li").first()).toBeVisible();
});

import { test, expect, Page } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

async function entrar(page: Page, email?: string, password?: string) {
  await page.goto("/login");
  if (email) {
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password!);
  }
  await page.getByRole("button", { name: /entrar|iniciar/i }).click();
  await expect(page.getByText("Hola,")).toBeVisible();
}

test("la página pública muestra el precio del plan y lleva a la demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Tu inventario al día/ })).toBeVisible();
  await expect(page.locator("#precios")).toContainText("$10");
  await expect(page.locator("#precios")).toContainText("$50 de implementación");
  await page.getByRole("link", { name: "Probar la demo" }).first().click();
  await expect(page).toHaveURL(/\/login/);
});

test("editar y eliminar un producto", async ({ page }) => {
  await entrar(page);
  await page.goto("/app/productos");
  await page.getByRole("button", { name: "Editar Aceite 900 ml" }).click();
  await page.getByLabel("Precio venta ($)").fill("3.60");
  await expect(page.getByTestId("margen")).toContainText("$1.20");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("ACE-900 · $3.60")).toBeVisible();

  await page.getByRole("button", { name: "Eliminar Detergente 1 kg" }).click();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(page.getByText("Detergente 1 kg", { exact: true })).toHaveCount(0);
});

test("importar inventario desde un CSV estilo Excel en español", async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), "instaya-"));
  const archivo = join(dir, "mi-inventario.csv");
  writeFileSync(
    archivo,
    "﻿Producto;Código;Costo;Precio;Existencias;Mínimo;Rubro\nCafé 400 g;CAF-400;3,00;4,50;12;3;Bebidas calientes\nArroz 5 lb;ARZ-5LB;2,60;3,75;55;10;Granos\n"
  );
  await entrar(page);
  await page.goto("/app/importar");
  await page.getByLabel("Archivo de inventario").setInputFiles(archivo);
  await expect(page.getByTestId("conteo-filas")).toHaveText("2 listas");
  await page.getByRole("button", { name: "Importar 2 productos" }).click();
  await expect(page.getByTestId("resultado-importacion")).toContainText("1 productos nuevos");
  await expect(page.getByTestId("resultado-importacion")).toContainText("1 productos actualizados");

  await page.goto("/app/productos");
  await expect(page.getByText("Café 400 g", { exact: true })).toBeVisible();
  await expect(page.getByText("55 u.")).toBeVisible();
});

test("un empleado puede vender pero no ve las opciones de administrador", async ({ page }) => {
  await entrar(page, "cajero@instaya.app", "cajero123");
  await page.goto("/app/productos");
  await expect(page.getByRole("button", { name: "+ Nuevo" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Importar Excel/ })).toHaveCount(0);
  await page.goto("/app/config");
  await expect(page.getByText("Equipo", { exact: true })).toHaveCount(0);
});

test("plan vencido: aviso, solo lectura y al pagar vuelve a registrar", async ({ page }) => {
  await entrar(page);
  await page.goto("/app/plan");
  await expect(page.getByTestId("estado-plan")).toContainText("Prueba gratuita");
  await page.getByRole("button", { name: "Simular vencimiento" }).click();
  await expect(page.getByTestId("estado-plan")).toContainText("terminó");
  await expect(page.getByTestId("aviso-plan")).toContainText("solo lectura");

  await page.goto("/app/ventas");
  await page.getByRole("button", { name: "+ Venta" }).click();
  await page.getByLabel("Producto").selectOption({ label: "Arroz 5 lb ($3.50 · 40 u.)" });
  await page.getByLabel("Cantidad").fill("1");
  await page.getByRole("button", { name: "Agregar" }).click();
  await page.getByRole("button", { name: "Registrar venta" }).click();
  await expect(page.getByText(/Renueva el plan/)).toBeVisible();

  await page.goto("/app/plan");
  await page.getByRole("button", { name: "Simular pago ($10)" }).click();
  await expect(page.getByTestId("estado-plan")).toContainText("Plan Básico activo");
  await expect(page.getByTestId("aviso-plan")).toHaveCount(0);
});

test("la app es instalable: manifest e íconos publicados", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(href!)).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
  expect((await request.get("/sw.js")).ok()).toBe(true);
});

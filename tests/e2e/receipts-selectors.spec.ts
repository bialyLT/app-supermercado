import { expect, test } from "@playwright/test";
import { admin, authenticateAdmin, enabled } from "./helpers/auth";
import {
  CATALOG,
  LOCATION_ID,
  VARIANT_ID,
  mockContextAndCatalog,
} from "./helpers/inventory-selectors";

// Navegador: selectores legibles de recepciones.
// Requiere servidor de dev y base de datos de gate (verifica el orquestador).
// Las rutas mockeadas aportan datos; la autenticación es real (el layout de
// /admin redirige sin sesión y los mocks no la omiten).

test.describe("selectores legibles de recepciones", () => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  test.afterAll(async () => {
    if (enabled) {
      await admin.$disconnect();
    }
  });

  test.beforeEach(async ({ page }) => {
    await authenticateAdmin(page);
  });

  for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
    test(`recepción publica IDs y conserva la clave ante reintento (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockContextAndCatalog(page);
      const posts: Array<Record<string, unknown>> = [];
      let attempts = 0;
      await page.route("**/api/admin/inventory/receipts", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ receipts: [] }) });
          return;
        }
        attempts += 1;
        posts.push(route.request().postDataJSON() as Record<string, unknown>);
        if (attempts === 1) {
          await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "REQUEST_FAILED" }) });
        } else {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
        }
      });
      await page.goto("/admin/inventory/receipts");

      const location = page.getByLabel("Ubicación", { exact: true });
      await expect(location).toBeVisible();
      await expect(location.locator("option").nth(1)).toHaveText("Depósito central (DEP-01)");
      await location.selectOption({ label: "Depósito central (DEP-01)" });

      const variant = page.getByRole("combobox", { name: "Variante" });
      await variant.fill("YER");
      await expect(page.getByRole("option", { name: /YER-500/ })).toBeVisible();
      await variant.press("ArrowDown");
      await variant.press("Enter");
      await expect(variant).toHaveValue("YER-500 — Yerba (Yerba 500g)");

      await page.locator("#receipt-quantity").fill("2");
      await page.locator("#receipt-reason").fill("Compra");
      await page.getByRole("button", { name: "Registrar recepción" }).click();
      await expect(page.getByText("Reintentá")).toBeVisible();
      await expect(page.locator("#receipt-quantity")).toHaveValue("2");
      await page.getByRole("button", { name: "Registrar recepción" }).click();
      await expect(page.getByText("Recepción registrada por el servidor.")).toBeVisible();

      expect(posts).toHaveLength(2);
      for (const key of ["locationId", "variantId", "quantity", "reason", "idempotencyKey"]) {
        expect(typeof posts[0][key]).toBe("string");
      }
      expect(posts[0].locationId).toBe(LOCATION_ID);
      expect(posts[0].variantId).toBe(VARIANT_ID);
      expect(posts[1].idempotencyKey).toBe(posts[0].idempotencyKey);

      await expect(location).toHaveCSS("min-height", "44px");
      await expect(variant).toHaveCSS("min-height", "44px");
      await location.focus();
      await expect(location).toBeFocused();
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    });
  }

  test("editar la variante invalida la selección y no publica la recepción", async ({ page }) => {
    await mockContextAndCatalog(page);
    const posts: Array<Record<string, unknown>> = [];
    await page.route("**/api/admin/inventory/receipts", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ receipts: [] }) });
        return;
      }
      posts.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.goto("/admin/inventory/receipts");

    await page.getByLabel("Ubicación", { exact: true }).selectOption({ label: "Depósito central (DEP-01)" });
    const variant = page.getByRole("combobox", { name: "Variante" });
    await variant.fill("YER");
    await expect(page.getByRole("option", { name: /YER-500/ })).toBeVisible();
    await variant.press("ArrowDown");
    await variant.press("Enter");
    await variant.press("End");
    await variant.type(" extra");
    await page.locator("#receipt-quantity").fill("2");
    await page.locator("#receipt-reason").fill("Compra");
    await page.getByRole("button", { name: "Registrar recepción" }).click();
    await expect(page.getByText("Buscá y seleccioná una variante del catálogo.")).toBeVisible();
    expect(posts).toHaveLength(0);
  });

  test("el catálogo limpia resultados anteriores ante una búsqueda nueva", async ({ page }) => {
    await mockContextAndCatalog(page);
    await page.route("**/api/pos/catalog*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CATALOG) });
    });
    await page.route("**/api/admin/inventory/receipts", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ receipts: [] }) });
    });
    await page.goto("/admin/inventory/receipts");

    const variant = page.getByRole("combobox", { name: "Variante" });
    await variant.fill("YER");
    await expect(page.getByRole("option", { name: /YER-500/ })).toBeVisible();
    await variant.fill("YERBAZ");
    await expect(page.getByRole("option", { name: /YER-500/ })).toHaveCount(0);
    await expect(page.getByRole("option", { name: /YER-500/ })).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";
import { admin, authenticateAdmin, enabled } from "./helpers/auth";
import {
  CATALOG,
  UNKNOWN_LOCATION_ID,
  mockContextAndCatalog,
  mockInventoryReads,
} from "./helpers/inventory-selectors";

// Navegador: selectores legibles de lectura de inventario.
// Requiere servidor de dev y base de datos de gate (verifica el orquestador).
// Las rutas mockeadas aportan datos; la autenticación es real (el layout de
// /admin redirige sin sesión y los mocks no la omiten).

test.describe("selectores legibles de inventario", () => {
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
    test(`inventario filtra por nombre sin UUID visible (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockContextAndCatalog(page);
      await mockInventoryReads(page, {});
      await page.goto("/admin/inventory");

      const location = page.getByLabel("Ubicación", { exact: true });
      await expect(location).toBeVisible();
      await location.selectOption({ label: "Depósito central (DEP-01)" });

      const variant = page.getByRole("combobox", { name: "Variante / SKU" });
      await variant.fill("YER");
      await expect(page.getByRole("option", { name: /YER-500/ })).toBeVisible();
      await variant.press("ArrowDown");
      await variant.press("Enter");
      await expect(page.getByText("YER-500 — Yerba (Yerba 500g)")).toBeVisible();

      await expect(location).toHaveCSS("min-height", "44px");
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    });
  }

  test("ubicación desconocida en la URL se representa sin perder el filtro", async ({ page }) => {
    await mockContextAndCatalog(page);
    const seen: { levelsUrl?: string } = {};
    await mockInventoryReads(page, seen);
    await page.goto(`/admin/inventory?locationId=${UNKNOWN_LOCATION_ID}`);

    const location = page.getByLabel("Ubicación", { exact: true });
    await expect(location).toHaveValue(UNKNOWN_LOCATION_ID);
    await expect(location.locator(`option[value="${UNKNOWN_LOCATION_ID}"]`)).toHaveText(
      "Ubicación actual (filtro aplicado)",
    );
    await expect.poll(() => seen.levelsUrl ?? "").toContain(`locationId=${UNKNOWN_LOCATION_ID}`);
  });

  test("ubicación desconocida en la URL no produce errores de hidratación", async ({ page }) => {
    await mockContextAndCatalog(page);
    await mockInventoryReads(page, {});
    const hydrationConsoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") hydrationConsoleErrors.push(message.text());
    });
    const hydrationPageErrors: string[] = [];
    page.on("pageerror", (error) => {
      hydrationPageErrors.push(String(error));
    });
    await page.goto(`/admin/inventory?locationId=${UNKNOWN_LOCATION_ID}`);
    const location = page.getByLabel("Ubicación", { exact: true });
    await expect(location.locator(`option[value="${UNKNOWN_LOCATION_ID}"]`)).toHaveText(
      "Ubicación actual (filtro aplicado)",
    );
    expect(hydrationConsoleErrors.filter((text) => /hydrat/i.test(text))).toHaveLength(0);
    expect(hydrationPageErrors.filter((text) => /hydrat/i.test(text))).toHaveLength(0);
  });

  test("ventas y caja preservan sus filtros sin selectores de inventario", async ({ page }) => {
    await page.route("**/api/admin/sales?*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sales: [] }) });
    });
    await page.route("**/api/admin/cash-shifts/history?*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shifts: [] }) });
    });
    for (const url of ["/admin/sales", "/admin/cash-shifts/history"]) {
      await page.goto(url);
      await expect(page.getByRole("button", { name: "Aplicar filtros" })).toBeVisible();
      await expect(page.getByPlaceholder("ID opcional").first()).toBeVisible();
      await expect(page.getByLabel("Ubicación", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("combobox")).toHaveCount(0);
      await expect(page.getByText("Ubicaciones por nombre no disponibles")).toHaveCount(0);
    }
  });

  test("texto de variante sin seleccionar no dispara consulta y conserva la búsqueda (R1)", async ({ page }) => {
    await mockContextAndCatalog(page);
    let levelsCount = 0;
    let movementsCount = 0;
    await page.route("**/api/admin/inventory/levels*", async (route) => {
      levelsCount += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ levels: [] }) });
    });
    await page.route("**/api/admin/inventory/movements*", async (route) => {
      movementsCount += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ movements: [] }) });
    });
    await page.goto("/admin/inventory");
    await expect(page.getByText("No hay resultados para los filtros seleccionados.")).toBeVisible();
    const initialLevels = levelsCount;
    const initialMovements = movementsCount;
    expect(initialLevels).toBeGreaterThanOrEqual(1);
    expect(initialMovements).toBeGreaterThanOrEqual(1);

    const variant = page.getByRole("combobox", { name: "Variante / SKU" });
    await variant.fill("YER");
    await expect(page.getByRole("option", { name: /YER-500/ })).toBeVisible();
    const baselineLevels = levelsCount;
    const baselineMovements = movementsCount;

    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Buscá y seleccioná una variante del catálogo." })).toBeVisible();
    await expect(variant).toHaveValue("YER");
    await page.waitForTimeout(600);
    expect(levelsCount).toBe(baselineLevels);
    expect(movementsCount).toBe(baselineMovements);

    await variant.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "Buscá y seleccioná una variante del catálogo." })).toBeVisible();
    await expect(variant).toHaveValue("YER");
    await page.waitForTimeout(600);
    expect(levelsCount).toBe(baselineLevels);
    expect(movementsCount).toBe(baselineMovements);
  });

  test("botón Quitar de variante cumple 44px y foco visible (R2)", async ({ page }) => {
    await mockContextAndCatalog(page);
    await mockInventoryReads(page, {});
    await page.goto("/admin/inventory");

    const variant = page.getByRole("combobox", { name: "Variante / SKU" });
    await variant.fill("YER");
    await expect(page.getByRole("option", { name: /YER-500/ })).toBeVisible();
    await variant.press("ArrowDown");
    await variant.press("Enter");
    const chipQuit = page.getByRole("button", { name: "Quitar" });
    await expect(chipQuit).toBeVisible();
    await expect(chipQuit).toHaveCSS("min-height", "44px");
    const chipBox = await chipQuit.boundingBox();
    expect((chipBox?.height ?? 0)).toBeGreaterThanOrEqual(44);
    for (let i = 0; i < 30; i += 1) {
      if (await chipQuit.evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(chipQuit).toBeFocused();
    const chipOutline = await chipQuit.evaluate((element) => getComputedStyle(element).outlineWidth);
    expect(chipOutline).not.toBe("0px");
  });

  test("ubicación en falla de contexto ofrece Quitar y Reintentar de 44px con foco visible (R2)", async ({ page }) => {
    await page.route("**/api/admin/context", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "REQUEST_FAILED" }) });
    });
    await page.route("**/api/pos/catalog*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CATALOG) });
    });
    await mockInventoryReads(page, {});
    await page.goto(`/admin/inventory?locationId=${UNKNOWN_LOCATION_ID}`);
    const fallbackQuit = page.getByRole("button", { name: "Quitar" });
    const retry = page.getByRole("button", { name: "Reintentar" }).first();
    await expect(fallbackQuit).toBeVisible();
    await expect(retry).toBeVisible();
    for (const button of [fallbackQuit, retry]) {
      await expect(button).toHaveCSS("min-height", "44px");
      const box = await button.boundingBox();
      expect((box?.height ?? 0)).toBeGreaterThanOrEqual(44);
      for (let i = 0; i < 30; i += 1) {
        if (await button.evaluate((element) => element === document.activeElement)) break;
        await page.keyboard.press("Tab");
      }
      await expect(button).toBeFocused();
      const outline = await button.evaluate((element) => getComputedStyle(element).outlineWidth);
      expect(outline).not.toBe("0px");
    }
  });
});

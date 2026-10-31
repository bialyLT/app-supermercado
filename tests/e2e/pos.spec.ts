import { test, expect } from "@playwright/test";
import { admin, authenticateAdmin, enabled } from "./helpers/auth";

test.afterAll(async () => {
  if (enabled) {
    await admin.$disconnect();
  }
});

test("POS exposes keyboard-first controls and touch-sized actions", async ({ page }) => {
  await page.goto("/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
  await expect(page.getByText(/F2 buscar/)).toBeVisible();
  const add = page.getByRole("button", { name: /Agregar \(F4\)/ });
  await expect(add).toBeVisible();
  await expect(add).toHaveCSS("min-height", "44px");
  await page.keyboard.press("F2");
  await expect(page.locator("#variant")).toBeFocused();
});

test("POS mutations reject unauthenticated callers", async ({ request }) => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  const checkout = await request.post("/api/pos/checkout", { data: { lines: [], payments: [], idempotencyKey: "e2e-pos" } });
  const product = await request.post("/api/pos/products", { data: { sku: "offline", name: "Offline", unitCode: "u", unitName: "Unit" } });
  const reversal = await request.post("/api/pos/reversals", { data: { saleId: "00000000-0000-4000-8000-000000000000", type: "ANNULMENT", lines: [], reason: "e2e", idempotencyKey: "e2e-reversal" } });
  expect(checkout.status()).toBe(401);
  expect(product.status()).toBe(401);
  expect(reversal.status()).toBe(401);
});

test("POS resolves weighed barcode, preserves unit price and barcode, adds to cart via F4, and clears input", async ({ page }) => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  const { fixture } = await authenticateAdmin(page);

  let checkoutBody: { lines: Array<{ variantId: string; locationId: string; quantity: string; unitPrice?: string; weighedBarcode?: string }> } | null = null;
  await page.route("**/api/pos/checkout", async (route) => {
    checkoutBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "sale-weighed-001", change: "0.00" }),
    });
  });

  await page.route("**/api/pos/barcodes/price*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        variantId: "123e4567-e89b-42d3-a456-426614174000",
        sku: "12345",
        name: "Manzanas",
        productName: "Manzanas",
        unitPrice: "1.25",
      }),
    });
  });

  await page.goto("/pos");
  await expect(page.getByText("Ubicación autorizada por el servidor")).toBeVisible();
  await page.locator("#variant").fill("2012345001251");
  await expect(page.getByRole("status").filter({ hasText: "Código pesable: precio unitario 1.25" })).toBeVisible();

  // Select suggestion
  await page.getByRole("button", { name: /Manzanas/ }).click();

  // Add line via F4
  await page.keyboard.press("F4");
  await expect(page.getByRole("region", { name: "Carrito" })).toContainText("123e4567-e89b-42d3-a456-426614174000 × 1");
  await expect(page.locator("#variant")).toHaveValue("");

  // Pay and confirm via F10
  await page.locator("#payment").fill("1.25");
  await page.keyboard.press("F10");
  await expect(page.getByRole("status").filter({ hasText: "Venta sale-weighed-001" })).toBeVisible();

  expect(checkoutBody).not.toBeNull();
  expect(checkoutBody!.lines).toHaveLength(1);
  expect(checkoutBody!.lines[0]).toMatchObject({
    variantId: "123e4567-e89b-42d3-a456-426614174000",
    locationId: fixture.locationId,
    quantity: "1",
    unitPrice: "1.25",
    weighedBarcode: "2012345001251",
  });
});

test("POS normal catalogue checkout omits provenance", async ({ page }) => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  const { fixture } = await authenticateAdmin(page);

  let checkoutBody: { lines: Array<{ variantId: string; locationId: string; quantity: string; unitPrice?: string; weighedBarcode?: string }> } | null = null;
  await page.route("**/api/pos/checkout", async (route) => {
    checkoutBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "sale-normal-001", change: "0.00" }),
    });
  });
  await page.route("**/api/pos/catalog*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [{
          id: "123e4567-e89b-42d3-a456-426614174001",
          sku: "7791234567890",
          name: "Gaseosa",
          productName: "Gaseosa Cola",
        }],
      }),
    });
  });

  await page.goto("/pos");
  await expect(page.getByText("Ubicación autorizada por el servidor")).toBeVisible();
  await page.locator("#variant").fill("Gaseosa");
  const suggestion = page.getByRole("button", { name: /Gaseosa/ });
  await expect(suggestion).toBeVisible();
  await suggestion.click();

  await page.keyboard.press("F4");
  await expect(page.getByRole("region", { name: "Carrito" })).toContainText("123e4567-e89b-42d3-a456-426614174001 × 1");

  await page.locator("#payment").fill("10.00");
  await page.keyboard.press("F10");
  await expect(page.getByRole("status").filter({ hasText: "Venta sale-normal-001" })).toBeVisible();

  expect(checkoutBody).not.toBeNull();
  expect(checkoutBody!.lines).toHaveLength(1);
  expect(checkoutBody!.lines[0]).toMatchObject({
    variantId: "123e4567-e89b-42d3-a456-426614174001",
    locationId: fixture.locationId,
    quantity: "1",
  });
  expect(checkoutBody!.lines[0].weighedBarcode).toBeUndefined();
  expect(checkoutBody!.lines[0].unitPrice).toBeUndefined();
});

test("POS falls back to catalog when 13-digit barcode prefix mismatches or is not configured", async ({ page }) => {
  await page.route("**/api/pos/barcodes/price*", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "EAN13_PREFIX_MISMATCH" }),
    });
  });
  await page.route("**/api/pos/catalog*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [{
          id: "123e4567-e89b-42d3-a456-426614174001",
          sku: "7791234567890",
          name: "Gaseosa",
          productName: "Gaseosa Cola",
        }],
      }),
    });
  });

  await page.goto("/pos");
  await page.locator("#variant").fill("7791234567890");
  await expect(page.getByRole("list", { name: "Resultados de búsqueda" })).toContainText("Gaseosa · 7791234567890");
});

test("POS displays error message on invalid configured weighed barcode scan", async ({ page }) => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  await authenticateAdmin(page);

  await page.route("**/api/pos/barcodes/price*", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "INVALID_EAN13_CHECKSUM" }),
    });
  });

  await page.goto("/pos");
  await expect(page.getByText("Ubicación autorizada por el servidor")).toBeVisible();
  await page.locator("#variant").fill("2012345001259");
  await expect(page.getByRole("status").filter({ hasText: "Código pesable inválido: INVALID_EAN13_CHECKSUM" })).toBeVisible();
});

import { test, expect } from "@playwright/test";
import { admin, authenticateAdmin, enabled, seedAdminIdentity } from "./helpers/auth";

test.afterAll(async () => {
  if (enabled) {
    await admin.$disconnect();
  }
});

test("POS redirects unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/pos");
  await expect(page).toHaveURL("/");
});

test("POS exposes keyboard-first controls and touch-sized actions", async ({ page }) => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  await authenticateAdmin(page);
  await page.goto("/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
  await expect(page.getByText("Atajos: F2 buscar · F4 agregar · F8 pagar · F10 confirmar · Esc conserva el carrito")).toBeVisible();
  const queueStatus = page.getByRole("status").filter({ hasText: "Conectado" });
  await expect(queueStatus).toContainText("Pendientes:");
  await expect(queueStatus).toContainText("Procesando:");
  await expect(queueStatus).toContainText("Completados:");
  await expect(queueStatus).toContainText("Conflictos:");
  await expect(queueStatus).toContainText("Errores:");
  const add = page.getByRole("button", { name: /Agregar \(F4\)/ });
  const addPayment = page.getByRole("button", { name: "Agregar medio" });
  const confirm = page.getByRole("button", { name: /Confirmar \(F10\)/ });
  await expect(add).toBeVisible();
  await expect(add).toHaveCSS("min-height", "44px");
  await expect(add).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(addPayment).toBeVisible();
  await expect(addPayment).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(confirm).toBeVisible();
  await expect(confirm).toHaveCSS("background-color", "rgb(2, 132, 199)");
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveCSS("opacity", "0.6");
  await addPayment.click();
  await expect(page.getByLabel("Monto CARD")).toBeVisible();
  await page.keyboard.press("F2");
  await expect(page.locator("#variant")).toBeFocused();
  await expect(page.locator("#variant")).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("F8");
  await expect(page.locator("#payment")).toBeFocused();
  await expect(page.locator("#payment")).toHaveCSS("outline-width", "2px");
});

test("POS fits tablet viewport without horizontal overflow", async ({ page }) => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  await authenticateAdmin(page);
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/pos");
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  await expect(page.getByRole("button", { name: /Agregar \(F4\)/ })).toHaveCSS("min-height", "44px");

  await page.setViewportSize({ width: 1180, height: 820 });
  const landscapeOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(landscapeOverflow.scrollWidth).toBeLessThanOrEqual(landscapeOverflow.clientWidth);
});

test("POS selects the highlighted catalog result with ArrowDown and Enter", async ({ page }) => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  await authenticateAdmin(page);
  await page.route("**/api/pos/catalog*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [{ id: "123e4567-e89b-42d3-a456-426614174001", sku: "7791234567890", name: "Gaseosa", productName: "Gaseosa Cola" }] }),
    });
  });

  await page.goto("/pos");
  const combobox = page.getByRole("combobox", { name: "Variante / código" });
  await expect(page.getByText("Ubicación autorizada por el servidor")).toBeVisible();
  await combobox.fill("Gaseosa");
  await expect(combobox).toHaveAttribute("aria-expanded", "true");
  await combobox.press("ArrowDown");
  await expect(combobox).toHaveAttribute("aria-activedescendant", /option-0$/);
  await combobox.press("Enter");
  await expect(combobox).toHaveValue("Gaseosa Cola · 7791234567890");
  await expect(combobox).toHaveAttribute("aria-expanded", "false");
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
  await page.getByRole("option", { name: /Manzanas/ }).click();
  await expect(page.locator("#variant")).toHaveValue("Manzanas · 12345");

  // Add line via F4
  await page.keyboard.press("F4");
  await expect(page.getByRole("region", { name: "Carrito" })).toContainText("Manzanas · 12345 × 1");
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
  const suggestion = page.getByRole("option", { name: /Gaseosa/ });
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await expect(page.locator("#variant")).toHaveValue("Gaseosa Cola · 7791234567890");

  await page.keyboard.press("F4");
  const cart = page.getByRole("region", { name: "Carrito" });
  await expect(cart).toContainText("Gaseosa Cola · 7791234567890 × 1");
  await page.keyboard.press("Escape");
  await expect(cart).toContainText("Gaseosa Cola · 7791234567890 × 1");
  await expect(page.getByRole("status").filter({ hasText: "El carrito se conserva; no se realizó ningún cambio." })).toBeVisible();

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
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  await authenticateAdmin(page);
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
  await expect(page.getByRole("listbox", { name: "Variante / código resultados" })).toContainText("Gaseosa Cola");
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

test("T7/S7: unauthenticated / exposes the login form", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Ingresá a tu operación" })).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
});

test("T7/S7: authenticated ADMIN visiting / is redirected to /admin", async ({ page }) => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  await authenticateAdmin(page, "ADMIN");
  await page.goto("/");
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { name: "Panel Operativo y Administrativo" })).toBeVisible();
});

test("T7/S7: authenticated CASHIER visiting / is redirected to /pos", async ({ page }) => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  await authenticateAdmin(page, "CASHIER");
  await page.goto("/");
  await expect(page).toHaveURL(/\/pos/);
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
});

test("T7/S7: CASHIER completing the login form lands at /pos", async ({ page }) => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  const { user, password } = await seedAdminIdentity("CASHIER");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ingresá a tu operación" })).toBeVisible();
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/pos/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
});

for (const role of ["STOCK_MANAGER", "SUPERVISOR"] as const) {
  test(`T7/S7: authenticated ${role} visiting / is redirected to /admin`, async ({ page }) => {
    test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
    await authenticateAdmin(page, role);
    await page.goto("/");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: "Panel Operativo y Administrativo" })).toBeVisible();
  });
}

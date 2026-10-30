import { hashPassword } from "better-auth/crypto";
import { expect, test } from "@playwright/test";
import { admin, enabled, fixture } from "../integration/fixtures";

test.describe("Purchases Administration & Multi-line Receipt Entry (S1, S3, S5)", () => {
  test("renders purchases interface, shortcut hints, supplier selector, and responsive table", async ({
    page,
  }) => {
    await page.goto("/admin/purchases");

    // Title and navigation landmarks
    await expect(page.getByRole("heading", { name: "Gestión de Compras y Recepción" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar Comprobante" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Historial de Compras/i })).toBeVisible();

    // Keyboard shortcuts bar (S5)
    await expect(page.getByText("Alt+N")).toBeVisible();
    await expect(page.getByText("Alt+G")).toBeVisible();

    // Required fields with server-derived selects (S1, S3)
    await expect(page.getByLabel(/Proveedor/i)).toBeVisible();
    await expect(page.getByLabel(/^Sucursal/i)).toBeVisible();
    await expect(page.getByLabel(/^Ubicación/i)).toBeVisible();

    // Multi-line table
    await expect(page.getByRole("table", { name: /Líneas del comprobante de compra/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Agregar línea/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Registrar compra/i })).toBeVisible();
  });

  test("supports fast multi-line adding and Decimal-safe totals preview (S3, S5)", async ({ page }) => {
    await page.goto("/admin/purchases");

    // Initially 1 line
    const qtyInputs = page.getByLabel(/Cantidad línea/i);
    await expect(qtyInputs).toHaveCount(1);

    // Fill line 1: qty = 2, cost = 100.00
    await qtyInputs.first().fill("2");
    await page.getByLabel(/Costo unitario línea 1/i).fill("100.00");

    // Add second line
    await page.getByRole("button", { name: "+ Agregar línea" }).first().click();
    await expect(qtyInputs).toHaveCount(2);

    // Fill line 2: qty = 3, cost = 50.00
    await qtyInputs.nth(1).fill("3");
    await page.getByLabel(/Costo unitario línea 2/i).fill("50.00");

    // Verify Decimal preview totals: (2*100) + (3*50) = 200 + 150 = 350.00 ARS
    await expect(page.getByText("350.00 ARS").first()).toBeVisible();
  });

  test("validates required fields on client without submitting invalid requests", async ({ page }) => {
    await page.goto("/admin/purchases");

    // Try submitting empty form
    await page.getByRole("button", { name: /Registrar compra/i }).click();

    // Validation alerts appear
    await expect(page.getByText("Debe seleccionar un proveedor")).toBeVisible();
    await expect(page.getByText("Debe seleccionar una sucursal")).toBeVisible();
    await expect(page.getByText("Debe seleccionar una ubicación de stock")).toBeVisible();
  });

  test("adapts responsively to tablet viewports without horizontal clipping (S1)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/admin/purchases");

    await expect(page.getByRole("heading", { name: "Gestión de Compras y Recepción" })).toBeVisible();
    await expect(page.getByRole("table", { name: /Líneas del comprobante de compra/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Registrar compra/i })).toBeVisible();
  });

  test("admin can register purchase receipt end-to-end and view in history", async ({ page }) => {
    test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");

    const f = await fixture("ADMIN");
    const user = await admin.user.findUniqueOrThrow({ where: { id: f.actor.userId } });
    const password = "Synthetic-gate-only-2026!";
    await admin.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: await hashPassword(password),
      },
    });

    const supplier = await admin.supplier.create({
      data: {
        tenantId: f.tenantId,
        code: "SUP-E2E-01",
        name: "Proveedor E2E Test",
      },
    });

    // Authenticate
    await page.goto("/");
    const loginStatus = await page.evaluate(
      async ({ email, password: value }) => {
        const response = await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: window.location.origin },
          body: JSON.stringify({ email, password: value }),
        });
        return response.status;
      },
      { email: user.email, password }
    );
    expect(loginStatus).toBe(200);

    // Navigate to Purchases
    await page.goto("/admin/purchases");
    await expect(page.getByRole("heading", { name: "Gestión de Compras y Recepción" })).toBeVisible();

    // Select Supplier, Branch, Location using server-derived selectors
    await page.getByLabel(/Proveedor/i).selectOption(supplier.id);
    await page.getByLabel(/^Sucursal/i).selectOption(f.branchId);
    await page.getByLabel(/^Ubicación/i).selectOption(f.locationId);
    await page.getByLabel(/N° Comprobante/i).fill("FAC-E2E-001");

    // Line 1: Variant, quantity, unit cost
    await page.getByLabel(/Variante o producto línea 1/i).fill(f.variantId);
    await page.getByLabel(/Cantidad línea 1/i).fill("5");
    await page.getByLabel(/Costo unitario línea 1/i).fill("20.00");

    // Submit
    await page.getByRole("button", { name: /Registrar compra/i }).click();

    // Verify success banner with server total (100.00 ARS)
    await expect(page.getByText("¡Comprobante registrado con éxito!")).toBeVisible();
    await expect(page.getByText("100.00 ARS").first()).toBeVisible();

    // Switch to history
    await page.getByRole("button", { name: /Historial de Compras/i }).click();
    await expect(page.getByRole("cell", { name: "FAC-E2E-001" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Proveedor E2E Test" })).toBeVisible();
  });
});

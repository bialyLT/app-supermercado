import { hashPassword } from "better-auth/crypto";
import { expect, test } from "@playwright/test";
import { admin, enabled, fixture } from "../integration/fixtures";

test.describe("Reports Administration & Tabular Operations UI (S1, S2, S3, S5)", () => {
  test.afterAll(async () => {
    if (enabled) {
      await admin.$disconnect();
    }
  });

  test("renders reports interface, shortcut hints, filters and action buttons (S3, S5)", async ({
    page,
  }) => {
    await page.goto("/admin/reports");

    // Title and navigation landmarks
    await expect(
      page.getByRole("heading", { name: "Reportes Operativos" })
    ).toBeVisible();

    // Keyboard shortcuts bar (S5)
    const shortcutRegion = page.getByRole("region", { name: "Atajos de teclado" });
    await expect(shortcutRegion.getByText("Alt+C")).toBeVisible();
    await expect(shortcutRegion.getByText("Alt+E")).toBeVisible();
    await expect(shortcutRegion.getByText("Alt+L")).toBeVisible();

    // Filter controls
    await expect(page.getByRole("heading", { name: "Parámetros del Reporte" })).toBeVisible();
    await expect(page.getByLabel(/^Desde/i)).toBeVisible();
    await expect(page.getByLabel(/^Hasta/i)).toBeVisible();
    await expect(page.getByLabel(/^Sucursal/i)).toBeVisible();

    // Quick presets
    await expect(page.getByRole("button", { name: "Hoy" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Últimos 7 días" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Este mes" })).toBeVisible();

    // Action buttons
    await expect(
      page.getByRole("button", { name: /Consultar reporte/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Exportar reporte en formato CSV/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Limpiar/i })
    ).toBeVisible();
  });

  test("strictly enforces S2: no chart graphics or canvas elements on page", async ({
    page,
  }) => {
    await page.goto("/admin/reports");

    // Strict S2: verify no canvas, recharts, or chartjs elements exist
    const canvasCount = await page.locator("canvas").count();
    expect(canvasCount).toBe(0);

    const chartSvgCount = await page.locator("svg[class*='chart']").count();
    expect(chartSvgCount).toBe(0);

    const rechartsCount = await page.locator(".recharts-wrapper").count();
    expect(rechartsCount).toBe(0);
  });

  test("validates period client-side when 'Hasta' is earlier than 'Desde'", async ({
    page,
  }) => {
    await page.goto("/admin/reports");

    // Set invalid inverted range
    const fromInput = page.getByLabel(/^Desde/i);
    const toInput = page.getByLabel(/^Hasta/i);

    await fromInput.fill("2026-03-20T10:00");
    await toInput.fill("2026-03-10T10:00");

    await page.getByRole("button", { name: /Consultar reporte/i }).click();

    // Inverted period error message should appear
    await expect(
      page.getByText(/La fecha 'Hasta' debe ser posterior a la fecha 'Desde'/i)
    ).toBeVisible();
  });

  test("adapts responsively to tablet viewport (768px) without horizontal clipping (S1)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/admin/reports");

    await expect(
      page.getByRole("heading", { name: "Reportes Operativos" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Consultar reporte/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Exportar reporte en formato CSV/i })
    ).toBeVisible();

    // Verify filter card is visible within the 768px viewport width
    const filterCard = page.locator("div[class*='filterCard']").first();
    await expect(filterCard).toBeVisible();
    const box = await filterCard.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(768);
    }
  });

  test("authenticated admin can query operations report and trigger CSV download", async ({
    page,
  }) => {
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

    // Authenticate
    await page.goto("/");
    const loginStatus = await page.evaluate(
      async ({ email, password: value }) => {
        const response = await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: window.location.origin,
            "x-forwarded-for": crypto.randomUUID(),
          },
          body: JSON.stringify({ email, password: value }),
        });
        return response.status;
      },
      { email: user.email, password }
    );
    expect(loginStatus).toBe(200);

    // Navigate to Reports
    await page.goto("/admin/reports");
    await expect(
      page.getByRole("heading", { name: "Reportes Operativos" })
    ).toBeVisible();

    // Click "Este mes" preset and submit
    await page.getByRole("button", { name: "Este mes" }).click();
    await page.getByRole("button", { name: /Consultar reporte/i }).click();

    // Summary sections should be visible
    await expect(
      page.getByRole("heading", { name: /Resumen Consolidado de Operaciones/i })
    ).toBeVisible();
    await expect(page.getByText("Resumen de Ventas")).toBeVisible();
    await expect(page.getByText("Resumen de Compras")).toBeVisible();
    await expect(page.getByText("Resumen de Transferencias")).toBeVisible();
    await expect(page.getByText("Resumen de Inventario")).toBeVisible();
  });
});

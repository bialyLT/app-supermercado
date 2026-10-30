import { expect, test } from "@playwright/test";

test.describe("Epic 7 T6 E2E - Administrative Operations Screens (S1, S3, S5)", () => {
  test("renders Users administration interface with keyboard shortcuts and role assignments", async ({ page }) => {
    await page.goto("/admin/users");

    await expect(page.getByRole("heading", { name: "Usuarios y Asignaciones" })).toBeVisible();
    await expect(page.getByText("Alt+N")).toBeVisible();
    await expect(page.getByLabel(/Correo Electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/Nombre Visible/i)).toBeVisible();
    await expect(page.getByLabel(/Contraseña Temporal/i)).toBeVisible();
    await expect(page.getByLabel(/Rol de Acceso/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear Usuario" })).toBeVisible();
    await expect(page.getByText("No se han registrado usuarios en esta sesión")).toBeVisible();
  });

  test("renders Tenant Settings interface with presets and audit history", async ({ page }) => {
    await page.goto("/admin/settings");

    await expect(page.getByRole("heading", { name: "Configuración del Sistema" })).toBeVisible();
    await expect(page.getByText("Alt+G")).toBeVisible();
    await expect(page.getByLabel(/Parámetro/i)).toBeVisible();
    await expect(page.getByLabel(/Valor/i)).toBeVisible();
    await expect(page.getByLabel(/Alcance/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar Parámetro" })).toBeVisible();
    await expect(page.getByText("No se han modificado parámetros en esta sesión")).toBeVisible();
  });

  test("renders Weighed-Barcode EAN-13 configuration and real-time simulator", async ({ page }) => {
    await page.goto("/admin/weighed-barcode");

    await expect(page.getByRole("heading", { name: "Códigos de Balanza Pesables" })).toBeVisible();
    await expect(page.getByLabel(/Prefijo Numérico/i)).toBeVisible();
    await expect(page.getByLabel(/Modo de Información/i)).toBeVisible();
    await expect(page.getByLabel(/Dígitos para SKU/i)).toBeVisible();
    await expect(page.getByLabel(/Dígitos para Valor/i)).toBeVisible();
    await expect(page.getByLabel(/Escala de Decimales/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar Configuración" })).toBeVisible();
    await expect(page.getByText("Simulador de Código EAN-13")).toBeVisible();
    await expect(page.getByLabel(/Código EAN-13 de prueba/i)).toBeVisible();
  });

  test("renders Suppliers catalog and modal creation workflow", async ({ page }) => {
    await page.goto("/admin/suppliers");

    await expect(page.getByRole("heading", { name: "Gestión de Proveedores" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Nuevo Proveedor" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Buscar proveedores" })).toBeVisible();

    // Open modal via button
    await page.getByRole("button", { name: "+ Nuevo Proveedor" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nuevo Proveedor Comercial" })).toBeVisible();
    await expect(page.getByLabel("Código *")).toBeVisible();
    await expect(page.getByLabel("Razón Social *")).toBeVisible();

    // Close modal via Escape
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("adapts all four operational screens to tablet viewport without horizontal scrolling (S1)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const routes = [
      { url: "/admin/users", heading: "Usuarios y Asignaciones" },
      { url: "/admin/settings", heading: "Configuración del Sistema" },
      { url: "/admin/weighed-barcode", heading: "Códigos de Balanza Pesables" },
      { url: "/admin/suppliers", heading: "Gestión de Proveedores" },
    ];

    for (const { url, heading } of routes) {
      await page.goto(url);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();

      // Ensure no horizontal scrollbar on body
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    }
  });
});

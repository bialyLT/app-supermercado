import { expect, test } from "@playwright/test";

test.describe("Administrative Application Shell & Navigation", () => {
  test("renders admin dashboard, non-editable role badge, and full navigation on desktop", async ({ page }) => {
    await page.goto("/admin");
    // Verify skip link
    const skipLink = page.getByRole("link", { name: "Saltar al contenido principal" });
    await expect(skipLink).toBeAttached();

    // Verify main headings and navigation
    await expect(page.getByRole("heading", { name: "Panel Operativo y Administrativo" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Menú principal" })).toBeVisible();

    // Verify breadcrumbs
    await expect(page.getByRole("navigation", { name: "Miga de pan" })).toBeVisible();

    // Verify role is displayed as a non-editable badge and no role selector exists
    await expect(page.getByLabel(/Rol activo:/i)).toBeVisible();
    await expect(page.locator("select#role-select")).toHaveCount(0);

    // Verify neutral branch state when no real branches are supplied
    await expect(page.getByText("Sin sucursales asignadas")).toBeVisible();

    // Verify links to administrative modules
    const mainNavigation = page.getByRole("navigation", { name: "Menú principal" });
    await expect(mainNavigation.getByRole("link", { name: /Promociones N×M/i })).toBeVisible();
    await expect(mainNavigation.getByRole("link", { name: /Punto de Venta/i })).toBeVisible();
  });

  test("supports keyboard shortcuts and modal help dialog (S5)", async ({ page }) => {
    await page.goto("/admin");

    // Click keyboard help button
    const shortcutButton = page.getByRole("button", { name: "Ver atajos de teclado" });
    await expect(shortcutButton).toBeVisible();
    await shortcutButton.click();

    // Modal dialog is shown
    const dialog = page.getByRole("dialog", { name: "Atajos de teclado" });
    await expect(dialog).toBeVisible();
    await expect(page.getByText("Ir al Inicio del panel administrativo")).toBeVisible();
    await expect(page.getByText("Ir al Punto de Venta (POS)")).toBeVisible();

    // Close with Escape key
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("adapts responsively to tablet viewport (S1)", async ({ page }) => {
    // Set tablet viewport (768 x 1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/admin");

    // Mobile/tablet menu toggle button should be visible
    const menuButton = page.getByRole("button", { name: "Alternar menú de navegación" });
    await expect(menuButton).toBeVisible();

    // Open sidebar drawer
    await menuButton.click();
    await expect(page.getByRole("button", { name: "Cerrar navegación" })).toBeVisible();

    // Close drawer with close button
    await page.getByRole("button", { name: "Cerrar navegación" }).click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#admin-sidebar")).not.toHaveClass(/sidebarOpen/);
  });

  test("preserves POS behavior and navigability", async ({ page }) => {
    await page.goto("/pos");
    // Verify POS title and independent functionality
    await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
  });
});

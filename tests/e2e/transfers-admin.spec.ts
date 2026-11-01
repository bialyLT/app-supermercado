import { expect, test } from "@playwright/test";
import { admin, authenticateAdmin, enabled } from "./helpers/auth";

test.describe("Transfer tabs accessibility", () => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  test.afterAll(async () => {
    if (enabled) await admin.$disconnect();
  });

  test("supports roving focus and arrow navigation", async ({ page }) => {
    await authenticateAdmin(page);
    await page.goto("/admin/transfers");

    const tablist = page.getByRole("tablist", { name: "Pestañas de transferencias" });
    const formTab = page.getByRole("tab", { name: "Nueva Transferencia" });
    const historyTab = page.getByRole("tab", { name: /Transferencias Recientes/ });

    await expect(tablist).toBeVisible();
    await expect(formTab).toHaveAttribute("aria-selected", "true");
    await expect(formTab).toHaveAttribute("tabindex", "0");
    await expect(historyTab).toHaveAttribute("tabindex", "-1");

    await formTab.focus();
    await formTab.press("ArrowRight");
    await expect(historyTab).toBeFocused();
    await expect(historyTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "transfer-tab-history");
  });
});

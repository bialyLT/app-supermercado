import { test, expect } from "@playwright/test";

test("home route starts and exposes foundation heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Supermercado" })).toBeVisible();
});

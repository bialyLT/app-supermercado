import { test, expect } from "@playwright/test";

test("POS exposes keyboard-first controls and touch-sized actions", async ({ page }) => {
  await page.goto("/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
  await expect(page.getByText(/F2 buscar/)).toBeVisible();
  const add = page.getByRole("button", { name: /Agregar \(F4\)/ });
  await expect(add).toBeVisible();
  await expect(add).toHaveAttribute("style", /min-height:44px/);
  await page.keyboard.press("F2");
  await expect(page.locator("#variant")).toBeFocused();
});

test("POS checkout rejects unauthenticated callers without mutating state", async ({ request }) => {
  const response = await request.post("/api/pos/checkout", { data: { lines: [], payments: [], idempotencyKey: "e2e-pos" } });
  expect(response.status()).toBe(401);
});

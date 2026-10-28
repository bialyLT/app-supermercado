import { test, expect } from "@playwright/test";

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
  const checkout = await request.post("/api/pos/checkout", { data: { lines: [], payments: [], idempotencyKey: "e2e-pos" } });
  const product = await request.post("/api/pos/products", { data: { sku: "offline", name: "Offline", unitCode: "u", unitName: "Unit" } });
  const reversal = await request.post("/api/pos/reversals", { data: { saleId: "00000000-0000-4000-8000-000000000000", type: "ANNULMENT", lines: [], reason: "e2e", idempotencyKey: "e2e-reversal" } });
  expect(checkout.status()).toBe(401);
  expect(product.status()).toBe(401);
  expect(reversal.status()).toBe(401);
});

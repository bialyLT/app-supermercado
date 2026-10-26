import { test, expect } from "@playwright/test";

test("home route starts and exposes foundation heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Supermercado" })).toBeVisible();
});

test("sensitive routes reject unauthenticated callers", async ({ request }) => {
  const response = await request.post("/api/admin/settings", {
    data: { setting: "timezone", value: "UTC" },
  });
  expect(response.status()).toBe(401);
});

test("sensitive input cannot provide tenant authority", async ({ request }) => {
  const response = await request.post("/api/admin/settings", {
    data: { setting: "timezone", value: "UTC", tenantId: "00000000-0000-4000-8000-000000000000" },
  });
  expect(response.status()).toBe(400);
});

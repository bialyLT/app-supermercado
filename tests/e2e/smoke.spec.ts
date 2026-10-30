import { test, expect } from "@playwright/test";

test("home route exposes the public sign-in entry and improved welcome view", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Supermercado" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ingresá a tu operación" })).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
  await expect(page.getByText("Operaciones, stock y caja en un solo lugar")).toBeVisible();
});

test("login form keeps the user informed when credentials are rejected", async ({ page }) => {
  await page.route("**/api/auth/sign-in/email", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "INVALID_CREDENTIALS" }) });
  });

  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("operador@example.test");
  await page.getByLabel("Contraseña").fill("wrong-password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("form", { name: "Inicio de sesión" }).getByRole("alert")).toHaveText("No pudimos iniciar sesión. Revisá tu correo y contraseña.");
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

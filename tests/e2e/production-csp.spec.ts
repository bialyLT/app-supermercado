import { expect, test } from "@playwright/test";

test("production CSP allows hydration and login interaction", async ({ page }) => {
  const policyViolations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to execute|Refused to apply/i.test(message.text())) {
      policyViolations.push(message.text());
    }
  });
  await page.route("**/api/auth/sign-in/email", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "INVALID_CREDENTIALS" }),
    });
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Ingresá a tu operación" })).toBeVisible();
  await page.getByLabel("Correo electrónico").fill("operador@example.test");
  await page.getByLabel("Contraseña").fill("wrong-password");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(
    page.getByRole("form", { name: "Inicio de sesión" }).getByRole("alert"),
  ).toHaveText("No pudimos iniciar sesión. Revisá tu correo y contraseña.");
  expect(policyViolations).toEqual([]);
});

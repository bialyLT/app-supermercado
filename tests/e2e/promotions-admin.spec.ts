import { hashPassword } from "better-auth/crypto";
import { expect, test } from "@playwright/test";
import { admin, enabled, fixture } from "../integration/fixtures";

test.describe("promotion administration UI", () => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  test.afterAll(() => admin.$disconnect());

  test("admin can create and deactivate a category promotion", async ({ page }) => {
    const f = await fixture("ADMIN");
    const category = await admin.productCategory.create({
      data: { tenantId: f.tenantId, code: "e2e-promotions", name: "E2E promotions" },
    });
    const user = await admin.user.findUniqueOrThrow({ where: { id: f.actor.userId } });
    const password = "Synthetic-gate-only-2026!";
    await admin.account.create({
      data: { userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword(password) },
    });

    await page.goto("/");
    const loginStatus = await page.evaluate(async ({ email, password: value }) => {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: window.location.origin },
        body: JSON.stringify({ email, password: value }),
      });
      return response.status;
    }, { email: user.email, password });
    expect(loginStatus).toBe(200);

    await page.goto("/admin/promotions");
    await expect(page.getByRole("heading", { name: "Promociones N×M" })).toBeVisible();
    await page.getByLabel("Categoría UUID").fill(category.id);
    await page.getByLabel("Nombre").fill("E2E 2x1");
    await page.getByRole("button", { name: "Crear promoción" }).click();
    await expect(page.getByRole("cell", { name: "E2E 2x1" })).toBeVisible();

    await page.getByRole("button", { name: "Desactivar" }).click();
    await expect(page.getByRole("cell", { name: "Inactiva" })).toBeVisible();
  });
});

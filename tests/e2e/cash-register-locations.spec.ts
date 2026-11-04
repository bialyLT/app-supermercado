import { expect, test } from "@playwright/test";
import { seedAdminIdentity, signInViaEmail, enabled } from "./helpers/auth";
import { admin } from "../integration/fixtures";

test.describe("cash register location administration", () => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  test.afterAll(() => admin.$disconnect());

  test("ADMIN assigns the active location; POS context then resolves the session snapshot", async ({ page }) => {
    const { fixture: f, user } = await seedAdminIdentity("ADMIN", { cashSession: false, unassignedRegister: true });
    await signInViaEmail(page, user.email);

    await page.goto("/admin/cash-registers");
    await expect(page.getByRole("heading", { name: "Cajas y ubicaciones" })).toBeVisible();
    await expect(page.locator("p").filter({ hasText: "Ubicación actual: sin asignar" })).toBeVisible();
    await page.getByLabel(/Ubicación activa de/).selectOption(f.locationId);

    const assigned = page.waitForResponse((response) =>
      response.request().method() === "POST" && response.url().includes("/api/admin/cash-registers"),
    );
    await page.getByRole("button", { name: "Asignar ubicación" }).click();
    expect((await assigned).status()).toBe(200);
    await expect(page.getByText("Ubicación asignada y auditada")).toBeVisible();

    const opened = await page.request.post("/api/admin/cash-shifts", {
      data: { action: "open", registerId: f.registerId, idempotencyKey: `e2e-open-${f.registerId}` },
    });
    expect(opened.status()).toBe(200);

    const context = await page.request.get("/api/pos/context");
    expect(context.status()).toBe(200);
    expect(await context.json()).toEqual({ locationId: f.locationId });
  });

  test("POS context stays fail-closed for an unassigned register", async ({ page }) => {
    const { user } = await seedAdminIdentity("CASHIER", { cashSession: false, unassignedRegister: true });
    await signInViaEmail(page, user.email);

    const context = await page.request.get("/api/pos/context");
    expect(context.status()).toBe(409);
    expect(await context.json()).toEqual({ error: "REGISTER_LOCATION_REQUIRED" });
  });
});

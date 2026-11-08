import { expect, test } from "@playwright/test";
import { admin, seedAdminIdentity, signInViaEmail, enabled } from "./helpers/auth";

test.describe("cash shift opening register selector", () => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  test.afterAll(() => admin.$disconnect());

  test("selecting a named register submits its internal registerId", async ({ page }) => {
    const { fixture: f, user } = await seedAdminIdentity("SUPERVISOR", { cashSession: false });
    await signInViaEmail(page, user.email);
    await page.goto("/admin/cash-shifts");

    const register = page.getByLabel("Caja", { exact: true });
    await expect(register).toBeEnabled();
    await expect(register.getByRole("option", {
      name: "Gate register — Gate branch (gate) · Location (l)",
    })).toBeAttached();
    await expect(page.getByText(f.registerId, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirmar operación" })).toBeDisabled();

    await register.selectOption(f.registerId);
    await page.getByLabel("Importe", { exact: true }).fill("0");
    await page.getByLabel("Motivo", { exact: true }).fill("Apertura desde selector");

    const requestPromise = page.waitForRequest((request) =>
      request.method() === "POST" && request.url().includes("/api/admin/cash-shifts"),
    );
    const responsePromise = page.waitForResponse((response) =>
      response.request().method() === "POST" && response.url().includes("/api/admin/cash-shifts"),
    );
    await page.getByRole("button", { name: "Confirmar operación" }).click();
    const [request, response] = await Promise.all([requestPromise, responsePromise]);

    expect(request.postDataJSON()).toMatchObject({ action: "open", registerId: f.registerId });
    expect(response.status()).toBe(200);
    const body = await response.json() as { id: string };
    const session = await admin.cashRegisterSession.findUniqueOrThrow({ where: { id: body.id } });
    expect(session.registerId).toBe(f.registerId);
    expect(session.userId).toBe(f.actor.userId);
  });

  test("retries register options after an initial read failure", async ({ page }) => {
    const { user } = await seedAdminIdentity("SUPERVISOR", { cashSession: false });
    await signInViaEmail(page, user.email);

    let allowReads = false;
    await page.route("**/api/admin/cash-shifts", async (route) => {
      if (route.request().method() === "GET" && !allowReads) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "TEMPORARY_FAILURE" }),
        });
        return;
      }
      await route.continue();
    });
    await page.goto("/admin/cash-shifts");

    await expect(page.getByText("No se pudieron cargar las cajas autorizadas. Reintentá.", { exact: true })).toBeVisible();
    allowReads = true;
    await page.getByRole("button", { name: "Reintentar cajas" }).click();

    const register = page.getByLabel("Caja", { exact: true });
    await expect(register).toBeEnabled();
    await expect(register.getByRole("option", {
      name: "Gate register — Gate branch (gate) · Location (l)",
    })).toBeAttached();
  });
});

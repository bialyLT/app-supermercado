import { hashPassword } from "better-auth/crypto";
import { test, expect } from "@playwright/test";
import { admin, enabled, fixture } from "../integration/fixtures";

test.describe("authentication with separated runtime database roles", () => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");
  test.afterAll(() => admin.$disconnect());

  test("cashier cannot access settings; public identity excludes internal session context", async ({ request }) => {
    const f = await fixture("CASHIER");
    const user = await admin.user.findUniqueOrThrow({ where: { id: f.actor.userId } });
    const password = "Synthetic-gate-only-2026!";
    await admin.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword(password) } });
    const login = await request.post("/api/auth/sign-in/email", { headers: { origin: "http://127.0.0.1:3109" }, data: { email: user.email, password } });
    expect(login.status()).toBe(200);
    const identity = await request.get("/api/me");
    expect(identity.status()).toBe(200);
    expect(await identity.json()).not.toHaveProperty("sessionId");
    const forbidden = await request.post("/api/admin/settings", { data: { setting: "timezone", value: "UTC" } });
    expect(forbidden.status()).toBe(403);
  });

  test("admin cannot use a foreign branch and can create a same-tenant user", async ({ request }) => {
    const f = await fixture();
    const other = await fixture();
    const user = await admin.user.findUniqueOrThrow({ where: { id: f.actor.userId } });
    const password = "Synthetic-gate-only-2026!";
    await admin.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword(password) } });
    const login = await request.post("/api/auth/sign-in/email", { headers: { origin: "http://127.0.0.1:3109" }, data: { email: user.email, password } });
    expect(login.status()).toBe(200);
    const input = { email: `${crypto.randomUUID()}@example.test`, displayName: "Gate cashier", password, role: "CASHIER" };
    const foreign = await request.post("/api/admin/users", { data: { ...input, branchId: other.branchId } });
    const absent = await request.post("/api/admin/users", { data: { ...input, branchId: crypto.randomUUID() } });
    expect(foreign.status()).toBe(404);
    expect(absent.status()).toBe(404);
    const created = await request.post("/api/admin/users", { data: { ...input, branchId: f.branchId } });
    expect(created.status()).toBe(201);
    const logout = await request.post("/api/auth/sign-out", { headers: { origin: "http://127.0.0.1:3109" }, data: {} });
    expect(logout.status()).toBe(200);
    expect((await request.get("/api/me")).status()).toBe(401);
    const cashierLogin = await request.post("/api/auth/sign-in/email", {
      headers: { origin: "http://127.0.0.1:3109" }, data: { email: input.email, password },
    });
    expect(cashierLogin.status()).toBe(200);
  });
});

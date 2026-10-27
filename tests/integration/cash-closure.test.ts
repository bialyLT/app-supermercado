import { afterAll, describe, expect, it } from "vitest";
import { configureInventoryPolicy, openRegisterSession, closeRegisterSession, closeRegisterSessionBlind, recordCashMovement } from "../../src/server/cash";
import { confirmSale, recordReceipt } from "../../src/server/inventory";
import { setSupervisorPin, approveInventorySale } from "../../src/server/supervisor";
import { admin, runtime, fixture, addActor, clock, enabled, reconcile } from "./fixtures";

afterAll(async () => { await admin.$disconnect(); await runtime.$disconnect(); });
(enabled ? describe : describe.skip)("cash session and monetary budget closure", () => {
  it("preserves a legacy closed session without fabricated closure counts", async () => {
    const f = await fixture("ADMIN", { cashSession: false });
    const closedAt = new Date("2026-10-26T11:00:00Z");
    const legacy = await admin.cashRegisterSession.create({ data: {
      tenantId: f.tenantId,
      registerId: f.registerId,
      branchId: f.branchId,
      userId: f.actor.userId,
      currency: "XTS",
      openedAt: new Date("2026-10-26T10:00:00Z"),
      closedAt,
      closedBy: f.actor.userId,
    } });
    expect(legacy.closedAt).toEqual(closedAt);
    expect(legacy.closedBy).toBe(f.actor.userId);
    expect(legacy.declaredCash).toBeNull();
    expect(legacy.expectedCash).toBeNull();
    expect(legacy.difference).toBeNull();
  });

  it("records authorized append-only movements and closes blind with cash-only expected amount", async () => {
    const f = await fixture("ADMIN");
    await recordCashMovement(f.actor, { registerSessionId: f.registerSessionId!, type: "CASH_IN", amount: "5", reason: "Deposit", idempotencyKey: "cash-in" }, clock);
    await recordCashMovement(f.actor, { registerSessionId: f.registerSessionId!, type: "CASH_OUT", amount: "2", reason: "Petty cash", idempotencyKey: "cash-out" }, clock);
    await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", allowUnverifiedIntake: true, idempotencyKey: "transfer-sale" }, clock);
    const result = await closeRegisterSessionBlind(f.actor, { registerSessionId: f.registerSessionId!, countedCashAmount: "3", reason: "Counted", idempotencyKey: "blind-close" }, clock);
    expect(result).toMatchObject({ expectedCash: "3.00", declaredCash: "3.00", difference: "0.00" });
    expect(await admin.cashMovement.count({ where: { tenantId: f.tenantId, registerSessionId: f.registerSessionId } })).toBe(3);
    const session = await admin.cashRegisterSession.findUniqueOrThrow({ where: { id: f.registerSessionId } });
    expect(session.declaredCash?.toFixed(2)).toBe("3.00");
    expect(session.difference?.toFixed(2)).toBe("0.00");
  });

  it("audits a blind-close difference and rejects replay under a different key", async () => {
    const f = await fixture("ADMIN");
    const first = await closeRegisterSessionBlind(f.actor, { registerSessionId: f.registerSessionId!, countedCashAmount: "9", reason: "Short count", idempotencyKey: "blind-close" }, clock);
    expect(first.difference).toBe("9.00");
    await expect(closeRegisterSessionBlind(f.actor, { registerSessionId: f.registerSessionId!, countedCashAmount: "9", reason: "Again", idempotencyKey: "blind-close-2" }, clock)).rejects.toThrow("REGISTER_SESSION_ALREADY_CLOSED");
    await expect(closeRegisterSessionBlind(f.actor, { registerSessionId: f.registerSessionId!, countedCashAmount: "9", reason: "Replay", idempotencyKey: "blind-close" }, clock)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await expect(admin.cashMovement.updateMany({ where: { tenantId: f.tenantId }, data: { reason: "tampered" } })).rejects.toThrow();
    expect(await admin.auditLog.count({ where: { tenantId: f.tenantId, action: "cash.session.blind_closed" } })).toBe(1);
  });

  it("rejects cash movement authorization, currency mismatch, and malformed input before writes", async () => {
    const f = await fixture("CASHIER");
    const other = await fixture();
    await expect(recordCashMovement(f.actor, { registerSessionId: other.registerSessionId!, type: "CASH_IN", amount: "1", reason: "No", idempotencyKey: "foreign" }, clock)).rejects.toThrow("NOT_FOUND");
    await expect(recordCashMovement(f.actor, { registerSessionId: f.registerSessionId!, type: "CASH_IN", amount: "1.001", reason: "Bad", idempotencyKey: "precision" }, clock)).rejects.toThrow("INVALID_MONEY_PRECISION");
    expect(await admin.cashMovement.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("requires explicit currency/value configuration and server-side administration permission", async () => {
    const f = await fixture("ADMIN", { cashSession: false });
    await admin.unverifiedIntakePolicy.update({ where: { tenantId: f.tenantId }, data: { currency: null, maxSessionValue: null } });
    await expect(openRegisterSession(f.actor, { registerId: f.registerId, idempotencyKey: "open" }, clock)).rejects.toThrow("MONETARY_CONFIGURATION_REQUIRED");
    const cashier = await addActor(f.tenantId, f.branchId, "CASHIER");
    await expect(configureInventoryPolicy(cashier, { mode: "ALLOW_WITH_CAPS", currency: "XTS", maxSessionValue: "100" }, clock)).rejects.toThrow("FORBIDDEN");
    await configureInventoryPolicy(f.actor, { mode: "ALLOW_WITH_CAPS", currency: "XTS", maxSessionValue: "100" }, clock);
    expect((await openRegisterSession(f.actor, { registerId: f.registerId, idempotencyKey: "open" }, clock)).currency).toBe("XTS");
  });

  it("opens exactly once under 20 concurrent requests; closing is idempotent and irreversible", async () => {
    const f = await fixture("ADMIN", { cashSession: false });
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => openRegisterSession(f.actor, { registerId: f.registerId, idempotencyKey: `open-${i}` }, clock)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const session = await admin.cashRegisterSession.findFirstOrThrow({ where: { tenantId: f.tenantId } });
    const closed = await Promise.all(Array.from({ length: 20 }, () => closeRegisterSession(f.actor, { registerSessionId: session.id, idempotencyKey: "close" }, clock)));
    expect(new Set(closed.map((result) => result.id)).size).toBe(1);
    await expect(closeRegisterSession(f.actor, { registerSessionId: session.id, idempotencyKey: "close-again" }, clock)).rejects.toThrow("REGISTER_SESSION_ALREADY_CLOSED");
    await expect(admin.cashRegisterSession.update({ where: { id: session.id }, data: { closedAt: null, closedBy: null } })).rejects.toThrow("REGISTER_SESSION_IMMUTABLE");
    await expect(confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", idempotencyKey: "sale", allowUnverifiedIntake: true }, clock)).rejects.toThrow("REGISTER_SESSION_REQUIRED");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  }, 30000);

  it("uses actual register/branch ownership and denies insufficient roles", async () => {
    const f = await fixture("CASHIER");
    const other = await fixture();
    await expect(openRegisterSession(f.actor, { registerId: other.registerId, idempotencyKey: "foreign" }, clock)).rejects.toThrow("NOT_FOUND");
    await expect(closeRegisterSession(f.actor, { registerSessionId: other.registerSessionId!, idempotencyKey: "foreign" }, clock)).rejects.toThrow("NOT_FOUND");
    const manager = await addActor(f.tenantId, f.branchId, "STOCK_MANAGER");
    await expect(openRegisterSession(manager, { registerId: f.registerId, idempotencyKey: "denied" }, clock)).rejects.toThrow("FORBIDDEN");
    const colleague = await addActor(f.tenantId, f.branchId, "CASHIER");
    await expect(closeRegisterSession(colleague, { registerSessionId: f.registerSessionId!, idempotencyKey: "denied-close" }, clock)).rejects.toThrow("FORBIDDEN");
    const supervisor = await addActor(f.tenantId, f.branchId, "SUPERVISOR");
    await closeRegisterSession(supervisor, { registerSessionId: f.registerSessionId!, idempotencyKey: "supervisor-close" }, clock);
    const closed = await admin.cashRegisterSession.findUniqueOrThrow({ where: { id: f.registerSessionId } });
    expect(closed.closedBy).toBe(supervisor.userId);
  });

  it("enforces the monetary cap from server prices, across login renewal, with a new budget only for a new cash session", async () => {
    const f = await fixture("ADMIN", { unitPrice: "10" });
    await configureInventoryPolicy(f.actor, { mode: "ALLOW_WITH_CAPS", currency: "XTS", maxSessionValue: "15" }, clock);
    const input = { ...f.stock, quantity: "1", unitPrice: "10", allowUnverifiedIntake: true, idempotencyKey: "first" };
    const first = await confirmSale(f.actor, input, clock);
    const login = await admin.session.create({ data: { userId: f.actor.userId, token: crypto.randomUUID(), expiresAt: new Date("2030-01-01T00:00:00Z") } });
    const renewed = { ...f.actor, sessionId: login.id };
    await expect(confirmSale(renewed, { ...input, unitPrice: "1", idempotencyKey: "underprice" }, clock)).rejects.toThrow("PRICE_MISMATCH");
    await expect(confirmSale(renewed, { ...input, idempotencyKey: "over-cap" }, clock)).rejects.toThrow("UNVERIFIED_INTAKE_VALUE_CAP");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(1);
    await closeRegisterSession(renewed, { registerSessionId: f.registerSessionId!, idempotencyKey: "close" }, clock);
    expect(await confirmSale(renewed, input, clock)).toEqual(first);
    const next = await openRegisterSession(renewed, { registerId: f.registerId, idempotencyKey: "new-session" }, clock);
    await confirmSale(renewed, { ...input, idempotencyKey: "second" }, clock);
    const cases = await admin.unverifiedIntakeReview.findMany({ where: { tenantId: f.tenantId } });
    expect(new Set(cases.map((review) => review.registerSessionId))).toEqual(new Set([f.registerSessionId, next.id]));
    expect(cases.every((review) => review.currency === "XTS" && review.intakeValue?.toString() === "10")).toBe(true);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("enforces quantity per cash session rather than per user lifetime", async () => {
    const f = await fixture();
    await configureInventoryPolicy(f.actor, { mode: "ALLOW_WITH_CAPS", currency: "XTS", maxSessionValue: "100", maxSessionQuantity: "1" }, clock);
    const input = { ...f.stock, quantity: "1", unitPrice: "1", allowUnverifiedIntake: true, idempotencyKey: "first" };
    await confirmSale(f.actor, input, clock);
    await expect(confirmSale(f.actor, { ...input, idempotencyKey: "second" }, clock)).rejects.toThrow("UNVERIFIED_INTAKE_SESSION_CAP");
    await closeRegisterSession(f.actor, { registerSessionId: f.registerSessionId!, idempotencyKey: "close" }, clock);
    await openRegisterSession(f.actor, { registerId: f.registerId, idempotencyKey: "new-session" }, clock);
    await confirmSale(f.actor, { ...input, idempotencyKey: "second" }, clock);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("does not mix currencies in an open session and honors zero-decimal money", async () => {
    const f = await fixture();
    await expect(configureInventoryPolicy(f.actor, { mode: "ALLOW_WITH_CAPS", currency: "JPY", maxSessionValue: "1000" }, clock)).rejects.toThrow("OPEN_SESSION_CURRENCY_CONFLICT");
    await admin.price.update({ where: { id: f.priceId }, data: { currency: "JPY", amount: "100" } });
    await expect(confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "100", allowUnverifiedIntake: true, idempotencyKey: "sale" }, clock)).rejects.toThrow("CURRENCY_MISMATCH");
    await closeRegisterSession(f.actor, { registerSessionId: f.registerSessionId!, idempotencyKey: "close" }, clock);
    await configureInventoryPolicy(f.actor, { mode: "ALLOW_WITH_CAPS", currency: "JPY", maxSessionValue: "1000" }, clock);
    await openRegisterSession(f.actor, { registerId: f.registerId, idempotencyKey: "new-session" }, clock);
    const sale = await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "100", allowUnverifiedIntake: true, idempotencyKey: "sale" }, clock);
    expect(sale).toMatchObject({ total: "100", currency: "JPY" });
  });

  it("preserves fractional money at the upper supported range", async () => {
    const unitPrice = "900000000000000.123";
    const f = await fixture("ADMIN", { unitPrice });
    await closeRegisterSession(f.actor, { registerSessionId: f.registerSessionId!, idempotencyKey: "close" }, clock);
    await configureInventoryPolicy(f.actor, { mode: "ALLOW_WITH_CAPS", currency: "KWD", maxSessionValue: "900110700000000123.015",
      maxLineQuantity: "2000", maxSessionQuantity: "2000", maxVariantDailyQuantity: "2000" }, clock);
    await admin.productVariant.update({ where: { id: f.variantId }, data: { quantityPrecision: 3 } });
    await admin.price.update({ where: { id: f.priceId }, data: { currency: "KWD" } });
    await openRegisterSession(f.actor, { registerId: f.registerId, idempotencyKey: "open" }, clock);
    const sale = await confirmSale(f.actor, { ...f.stock, quantity: "1000.123", unitPrice, allowUnverifiedIntake: true, idempotencyKey: "large" }, clock);
    expect(sale.total).toBe("900110700000000123.015");
    const review = await admin.unverifiedIntakeReview.findFirstOrThrow({ where: { tenantId: f.tenantId } });
    expect(review.intakeValue?.toString()).toBe("900110700000000123.015");
  });

  it("accepts the same supported price range in catalog, approval and sale contracts", async () => {
    const unitPrice = "1000000000000000";
    const f = await fixture("ADMIN", { unitPrice });
    await recordReceipt(f.actor, { ...f.stock, quantity: "1", reason: "seed", idempotencyKey: "seed" }, clock);
    const supervisor = await addActor(f.tenantId, f.branchId, "SUPERVISOR");
    await setSupervisorPin(supervisor, { pin: "426859" }, clock);
    const sale = { ...f.stock, quantity: "1", unitPrice, idempotencyKey: "wide-price" };
    const approval = await approveInventorySale(f.actor, { approverUserId: supervisor.userId, pin: "426859", reason: "Range fixture", sale }, clock);
    const result = await confirmSale(f.actor, { ...sale, approvalToken: approval.token }, clock);
    expect(result.total).toBe("1000000000000000.00");
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("does not implicitly assign a currency to a legacy price", async () => {
    const f = await fixture();
    await admin.price.update({ where: { id: f.priceId }, data: { currency: null } });
    await expect(confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", allowUnverifiedIntake: true, idempotencyKey: "sale" }, clock)).rejects.toThrow("PRICE_CURRENCY_REQUIRED");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });
});

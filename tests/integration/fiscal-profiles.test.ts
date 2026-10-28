import { afterAll, describe, expect, it } from "vitest";
import { configureFiscalProfile, getFiscalProfile } from "../../src/server/fiscal";
import { confirmSale } from "../../src/server/inventory";
import { admin, runtime, fixture, addActor, clock, enabled } from "./fixtures";
import { fiscalSnapshotSchema } from "../../src/domain/fiscal";

afterAll(async () => { await admin.$disconnect(); await runtime.$disconnect(); });
(enabled ? describe : describe.skip)("argentina fiscal profiles", () => {
  it("configures an argentine store profile under the admin manage permission", async () => {
    const f = await fixture("ADMIN");
    const configured = await configureFiscalProfile(f.actor, { storeId: f.storeId, condition: "RESPONSABLE_INSCRIPTO", internalTicket: true }, clock);
    expect(configured).toEqual({ storeId: f.storeId, storeName: "Gate store", country: "AR", condition: "RESPONSABLE_INSCRIPTO", internalTicket: true });
    expect(await admin.fiscalProfile.count({ where: { tenantId: f.tenantId } })).toBe(1);
  });

  it("denies profile configuration without the admin manage permission and keeps the stored profile unchanged", async () => {
    const f = await fixture("CASHIER");
    await expect(configureFiscalProfile(f.actor, { storeId: f.storeId, condition: "MONOTRIBUTO", internalTicket: true }, clock)).rejects.toThrow("FORBIDDEN");
    expect(await admin.fiscalProfile.count({ where: { tenantId: f.tenantId } })).toBe(1);
  });

  it("rejects cross-tenant and malformed profile input without persisting", async () => {
    const f = await fixture("ADMIN");
    await expect(configureFiscalProfile(f.actor, { storeId: crypto.randomUUID(), condition: "MONOTRIBUTO", internalTicket: true }, clock)).rejects.toThrow("NOT_FOUND");
    await expect(configureFiscalProfile(f.actor, { storeId: "", condition: "MONOTRIBUTO", internalTicket: true }, clock)).rejects.toThrow();
    expect(await admin.fiscalProfile.count({ where: { tenantId: f.tenantId } })).toBe(1);
  });

  it("retrieves the shared store profile through an authorized branch", async () => {
    const f = await fixture("ADMIN");
    await configureFiscalProfile(f.actor, { storeId: f.storeId, condition: "MONOTRIBUTO", internalTicket: true }, clock);
    const context = await getFiscalProfile(f.actor, f.branchId, clock);
    expect(context).toEqual({ storeId: f.storeId, storeName: "Gate store", country: "AR", condition: "MONOTRIBUTO", internalTicket: true });
  });

  it("denies fiscal profile reads without the read permission", async () => {
    const f = await fixture("CASHIER");
    await expect(getFiscalProfile(f.actor, f.branchId, clock)).rejects.toThrow("FORBIDDEN");
  });

  it("rejects a branch outside the actor assignment within the same tenant and keeps the profile", async () => {
    const f = await fixture("ADMIN");
    await configureFiscalProfile(f.actor, { storeId: f.storeId, condition: "MONOTRIBUTO", internalTicket: true }, clock);
    const foreignBranch = await admin.branch.create({ data: { tenantId: f.tenantId, storeId: f.storeId, code: `gate-${crypto.randomUUID()}`, name: "Gate branch foreign" } });
    const foreignActor = await addActor(f.tenantId, foreignBranch.id, "ADMIN");
    await expect(getFiscalProfile(foreignActor, f.branchId, clock)).rejects.toThrow("NOT_FOUND");
    expect(await admin.fiscalProfile.count({ where: { tenantId: f.tenantId } })).toBe(1);
  });

  it("rejects cross-tenant store configuration against a real foreign tenant", async () => {
    const f = await fixture("ADMIN");
    const secondTenant = await admin.tenant.create({ data: { name: "Gate second tenant", slug: `gate-second-${crypto.randomUUID()}` } });
    const secondStore = await admin.store.create({ data: { tenantId: secondTenant.id, name: "Gate second store" } });
    await expect(configureFiscalProfile(f.actor, { storeId: secondStore.id, condition: "MONOTRIBUTO", internalTicket: true }, clock)).rejects.toThrow("NOT_FOUND");
    expect(await admin.fiscalProfile.count({ where: { tenantId: f.tenantId } })).toBe(1);
  });

  it("does not create a second fiscal profile for repeated configuration", async () => {
    const f = await fixture("ADMIN");
    await configureFiscalProfile(f.actor, { storeId: f.storeId, condition: "MONOTRIBUTO", internalTicket: true }, clock);
    await configureFiscalProfile(f.actor, { storeId: f.storeId, condition: "RESPONSABLE_INSCRIPTO", internalTicket: true }, clock);
    expect(await admin.fiscalProfile.count({ where: { tenantId: f.tenantId } })).toBe(1);
  });

  it("shares one store profile across branches of the same store", async () => {
    const f = await fixture("ADMIN");
    await configureFiscalProfile(f.actor, { storeId: f.storeId, condition: "RESPONSABLE_INSCRIPTO", internalTicket: true }, clock);
    const secondBranch = await admin.branch.create({ data: { tenantId: f.tenantId, storeId: f.storeId, code: `gate-${crypto.randomUUID()}`, name: "Gate branch second" } });
    const secondActor = await addActor(f.tenantId, secondBranch.id, "ADMIN");
    const context = await getFiscalProfile(secondActor, secondBranch.id, clock);
    expect(context).toEqual({ storeId: f.storeId, storeName: "Gate store", country: "AR", condition: "RESPONSABLE_INSCRIPTO", internalTicket: true });
  });

  it("denies profile management to roles without the manage permission", async () => {
    const f = await fixture("STOCK_MANAGER");
    await expect(configureFiscalProfile(f.actor, { storeId: f.storeId, condition: "MONOTRIBUTO", internalTicket: true }, clock)).rejects.toThrow("FORBIDDEN");
    expect(await admin.fiscalProfile.count({ where: { tenantId: f.tenantId } })).toBe(1);
  });

  it("attaches a typed version 1 fiscal snapshot and keeps the sale result contract", async () => {
    const f = await fixture("ADMIN", { unitPrice: "10" });
    await configureFiscalProfile(f.actor, { storeId: f.storeId, condition: "RESPONSABLE_INSCRIPTO", internalTicket: true }, clock);
    const result = await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "10", allowUnverifiedIntake: true, idempotencyKey: "fiscal-sale" }, clock);
    expect(result).toEqual({ id: expect.any(String), type: "SALE", total: "10.00", currency: "XTS", documentNumber: 1, change: "0.00" });
    const sale = await admin.sale.findFirstOrThrow({ where: { tenantId: f.tenantId }, orderBy: { createdAt: "desc" } });
    expect(fiscalSnapshotSchema.parse(sale.fiscalSnapshot)).toEqual({
      version: 1, storeId: f.storeId, storeName: "Gate store", country: "AR", condition: "RESPONSABLE_INSCRIPTO", internalTicket: true,
    });
  });

  it("preserves the previous snapshot when the profile changes and on idempotent replay", async () => {
    const f = await fixture("ADMIN", { unitPrice: "10" });
    await configureFiscalProfile(f.actor, { storeId: f.storeId, condition: "MONOTRIBUTO", internalTicket: true }, clock);
    const input = { ...f.stock, quantity: "1", unitPrice: "10", allowUnverifiedIntake: true, idempotencyKey: "fiscal-replay" };
    const first = await confirmSale(f.actor, input, clock);
    await configureFiscalProfile(f.actor, { storeId: f.storeId, condition: "RESPONSABLE_INSCRIPTO", internalTicket: true }, clock);
    const second = await confirmSale(f.actor, input, clock);
    expect(second).toEqual(first);
    const sale = await admin.sale.findFirstOrThrow({ where: { tenantId: f.tenantId }, orderBy: { createdAt: "desc" } });
    expect(fiscalSnapshotSchema.parse(sale.fiscalSnapshot)?.condition).toBe("MONOTRIBUTO");
  });

  it("keeps legacy sales without fabricated fiscal data for stores without profile", async () => {
    const f = await fixture("ADMIN", { unitPrice: "10" });
    await admin.fiscalProfile.delete({ where: { tenantId_storeId: { tenantId: f.tenantId, storeId: f.storeId } } });
    const result = await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "10", allowUnverifiedIntake: true, idempotencyKey: "fiscal-legacy" }, clock);
    expect(result.type).toBe("SALE");
    const sale = await admin.sale.findFirstOrThrow({ where: { tenantId: f.tenantId }, orderBy: { createdAt: "desc" } });
    expect(sale.fiscalSnapshot).toBeNull();
  });

  it("blocks runtime and owner tampering of the sale fiscal snapshot", async () => {
    const f = await fixture("ADMIN", { unitPrice: "10" });
    await configureFiscalProfile(f.actor, { storeId: f.storeId, condition: "RESPONSABLE_INSCRIPTO", internalTicket: true }, clock);
    const result = await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "10", allowUnverifiedIntake: true, idempotencyKey: "fiscal-tamper" }, clock);
    const sale = await admin.sale.findFirstOrThrow({ where: { tenantId: f.tenantId, id: result.id } });
    const before = sale.fiscalSnapshot;
    const fabricated = JSON.stringify({ version: 2, storeId: f.storeId, storeName: "Gate store", country: "AR", condition: "MONOTRIBUTO", internalTicket: true });
    await expect(runtime.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${f.tenantId}, true)`;
      await tx.$executeRaw`UPDATE "Sale" SET "fiscalSnapshot" = ${fabricated}::jsonb WHERE "tenantId" = ${f.tenantId}::uuid AND "id" = ${result.id}::uuid`;
    })).rejects.toThrow("FISCAL_SNAPSHOT_IMMUTABLE");
    await expect(admin.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${f.tenantId}, true)`;
      await tx.$executeRaw`UPDATE "Sale" SET "fiscalSnapshot" = ${fabricated}::jsonb WHERE "tenantId" = ${f.tenantId}::uuid AND "id" = ${result.id}::uuid`;
    })).rejects.toThrow("FISCAL_SNAPSHOT_IMMUTABLE");
    await expect(runtime.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${f.tenantId}, true)`;
      await tx.$executeRaw`DELETE FROM "Sale" WHERE "tenantId" = ${f.tenantId}::uuid AND "id" = ${result.id}::uuid`;
    })).rejects.toThrow("FISCAL_SNAPSHOT_PROTECTED");
    const after = await admin.sale.findFirstOrThrow({ where: { tenantId: f.tenantId, id: result.id } });
    expect(after.fiscalSnapshot).toEqual(before);
  });

  it("blocks fabricated fiscal snapshots on legacy sales without profile", async () => {
    const f = await fixture("ADMIN", { unitPrice: "10" });
    await admin.fiscalProfile.delete({ where: { tenantId_storeId: { tenantId: f.tenantId, storeId: f.storeId } } });
    const result = await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "10", allowUnverifiedIntake: true, idempotencyKey: "fiscal-legacy-tamper" }, clock);
    const fabricated = JSON.stringify({ version: 1, storeId: f.storeId, storeName: "Gate store", country: "AR", condition: "MONOTRIBUTO", internalTicket: true });
    await expect(runtime.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${f.tenantId}, true)`;
      await tx.$executeRaw`UPDATE "Sale" SET "fiscalSnapshot" = ${fabricated}::jsonb WHERE "tenantId" = ${f.tenantId}::uuid AND "id" = ${result.id}::uuid`;
    })).rejects.toThrow("FISCAL_SNAPSHOT_IMMUTABLE");
  });
});

import { afterAll, describe, expect, it } from "vitest";
import { getPosSessionLocation } from "../../src/server/cash";
import { TopologyError } from "../../src/domain/operational-mode";
import { admin, clock, enabled, fixture } from "./fixtures";

afterAll(() => admin.$disconnect());

(enabled ? describe : describe.skip)("simple mode POS context (KAN-15)", () => {
  it("resolves branch, register and location without any client input", async () => {
    const f = await fixture("CASHIER", { cashSession: false });
    await admin.tenant.update({ where: { id: f.tenantId }, data: { operationalMode: "SIMPLE" } });

    const resolved = await getPosSessionLocation(f.actor, clock);

    expect(resolved).toMatchObject({
      locationId: f.locationId,
      registerId: f.registerId,
      registerSessionId: null,
      sessionOpen: false,
    });
  });

  it("reports the open session once the cashier opens the till", async () => {
    const f = await fixture("CASHIER");
    await admin.tenant.update({ where: { id: f.tenantId }, data: { operationalMode: "SIMPLE" } });

    const resolved = await getPosSessionLocation(f.actor, clock);

    expect(resolved.registerSessionId).toBe(f.registerSessionId);
    expect(resolved.sessionOpen).toBe(true);
  });

  it("fails loudly when the tenant does not match the simple topology", async () => {
    const f = await fixture("CASHIER");
    await admin.tenant.update({ where: { id: f.tenantId }, data: { operationalMode: "SIMPLE" } });
    await admin.cashRegister.create({
      data: { tenantId: f.tenantId, branchId: f.branchId, name: "Segunda caja", locationId: f.locationId },
    });

    await expect(getPosSessionLocation(f.actor, clock)).rejects.toBeInstanceOf(TopologyError);
  });

  it("keeps multi mode on the session-driven resolution", async () => {
    const f = await fixture("CASHIER", { cashSession: false });

    await expect(getPosSessionLocation(f.actor, clock)).rejects.toThrow("REGISTER_LOCATION_REQUIRED");
  });
});

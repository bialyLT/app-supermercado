import { afterAll, describe, expect, it } from "vitest";
import { createTransfer, listTransfers } from "../../src/server/transfers";
import { recordReceipt } from "../../src/server/inventory";
import { admin, clock, enabled, fixture, addActor } from "./fixtures";

const makeDestination = async (tenantId: string, storeId: string) => {
  const branch = await admin.branch.create({ data: { tenantId, storeId, code: `dest-${crypto.randomUUID()}`, name: "Destination" } });
  const location = await admin.location.create({ data: { tenantId, branchId: branch.id, code: `dest-${crypto.randomUUID()}`, name: "Destination location" } });
  return { branch, location };
};

afterAll(async () => { await admin.$disconnect(); });

(enabled ? describe : describe.skip)("automatic inventory transfers", () => {
  it("moves stock atomically, records both ledger movements, and replays idempotently", async () => {
    const f = await fixture("ADMIN");
    const destination = await makeDestination(f.tenantId, f.storeId);
    const destinationActor = await addActor(f.tenantId, destination.branch.id, "ADMIN");
    const actor = { ...destinationActor, branchIds: [f.branchId, destination.branch.id] };

    await recordReceipt(f.actor, { ...f.stock, quantity: "10", reason: "transfer seed", idempotencyKey: `transfer-seed-${f.tenantId}` }, clock);
    const input = {
      originBranchId: f.branchId,
      destinationBranchId: destination.branch.id,
      originLocationId: f.locationId,
      destinationLocationId: destination.location.id,
      lines: [{ variantId: f.variantId, quantity: "4" }],
      idempotencyKey: `transfer-${f.tenantId}`,
    };

    const transfer = await createTransfer(actor, input, clock);
    const replay = await createTransfer(actor, input, clock);
    expect(replay.id).toBe(transfer.id);
    const history = await listTransfers(actor);
    expect(history).toHaveLength(1);
    expect(history[0]?.originBranchId).toBe(f.branchId);
    expect(history[0]?.destinationBranchId).toBe(destination.branch.id);
    expect(history[0]?.lines[0]?.quantity).toBe("4");

    const source = await admin.inventoryLevel.findFirst({ where: { tenantId: f.tenantId, locationId: f.locationId, variantId: f.variantId, lotId: null } });
    const destinationLevel = await admin.inventoryLevel.findFirst({ where: { tenantId: f.tenantId, locationId: destination.location.id, variantId: f.variantId, lotId: null } });
    expect(source?.onHand.toFixed(0)).toBe("6");
    expect(destinationLevel?.onHand.toFixed(0)).toBe("4");
    expect(await admin.inventoryTransfer.count({ where: { tenantId: f.tenantId } })).toBe(1);
    expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId, referenceId: transfer.id } })).toBe(2);

    await expect(createTransfer(actor, { ...input, lines: [{ variantId: f.variantId, quantity: "5" }] }, clock)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });

  it("rejects insufficient stock without creating a transfer or changing levels", async () => {
    const f = await fixture("ADMIN");
    const destination = await makeDestination(f.tenantId, f.storeId);
    const destinationActor = await addActor(f.tenantId, destination.branch.id, "ADMIN");
    const actor = { ...destinationActor, branchIds: [f.branchId, destination.branch.id] };
    const input = {
      originBranchId: f.branchId,
      destinationBranchId: destination.branch.id,
      originLocationId: f.locationId,
      destinationLocationId: destination.location.id,
      lines: [{ variantId: f.variantId, quantity: "1" }],
      idempotencyKey: `transfer-empty-${f.tenantId}`,
    };

    await expect(createTransfer(actor, input, clock)).rejects.toThrow("INSUFFICIENT_STOCK");
    expect(await admin.inventoryTransfer.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });
});

import { afterAll, describe, expect, it } from "vitest";
import {
  createDirectPurchaseReceipt,
  createSupplier,
  getPurchaseReceipt,
  listPurchaseReceipts,
} from "../../src/server/purchases";
import { admin, clock, enabled, fixture, reconcile, addActor } from "./fixtures";

afterAll(async () => {
  await admin.$disconnect();
});

(enabled ? describe : describe.skip)("direct purchase receipts repository", () => {
  it("creates direct purchase receipt with supplier, variant lines, taxes, stock ledger movement, and audit", async () => {
    const f = await fixture("ADMIN");
    const supplier = await createSupplier(f.actor, {
      code: "SUPP-001",
      name: "Proveedor Central",
      taxId: "30-11223344-5",
    });

    const input = {
      supplierId: supplier.id,
      branchId: f.branchId,
      locationId: f.locationId,
      receiptNumber: "REC-2026-001",
      currency: "XTS",
      idempotencyKey: `idem-purchase-${f.tenantId}`,
      subtotal: "100.00",
      taxTotal: "21.00",
      discountTotal: "0.00",
      total: "121.00",
      lines: [
        {
          variantId: f.variantId,
          quantity: "10",
          unitCost: "10.00",
          taxRate: "0.21",
        },
      ],
    };

    const receipt = await createDirectPurchaseReceipt(f.actor, input, clock);
    expect(receipt).toMatchObject({
      tenantId: f.tenantId,
      branchId: f.branchId,
      locationId: f.locationId,
      supplierId: supplier.id,
      receiptNumber: "REC-2026-001",
      currency: "XTS",
      subtotal: expect.any(Object),
      total: expect.any(Object),
    });
    expect(receipt.subtotal.toFixed(2)).toBe("100.00");
    expect(receipt.taxTotal.toFixed(2)).toBe("21.00");
    expect(receipt.total.toFixed(2)).toBe("121.00");

    // Stock ledger verification: level onHand updated
    const level = await admin.inventoryLevel.findFirst({
      where: { tenantId: f.tenantId, locationId: f.locationId, variantId: f.variantId },
    });
    expect(level?.onHand.toFixed(0)).toBe("10");

    // Inventory movement verification: direction IN, type RECEIPT, referenceId = receipt.id
    const movements = await admin.inventoryMovement.findMany({
      where: { tenantId: f.tenantId, referenceId: receipt.id },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      direction: "IN",
      type: "RECEIPT",
      referenceId: receipt.id,
    });
    expect(movements[0].quantity.toFixed(0)).toBe("10");

    // Audit log verification
    const auditLogs = await admin.auditLog.findMany({
      where: { tenantId: f.tenantId, entityId: receipt.id, action: "purchase.received" },
    });
    expect(auditLogs).toHaveLength(1);

    // No fiscal invoice issuance verification
    const fiscalSequences = await admin.documentSequence.findMany({
      where: { tenantId: f.tenantId },
    });
    expect(fiscalSequences).toHaveLength(0);

    // Reconcile ledger
    expect(await reconcile(f.tenantId)).toHaveLength(0);

    // Query list & get
    const list = await listPurchaseReceipts(f.actor, { branchId: f.branchId });
    expect(list.map((r) => r.id)).toContain(receipt.id);
    const fetched = await getPurchaseReceipt(f.actor, receipt.id);
    expect(fetched.id).toBe(receipt.id);
  });

  it("handles idempotency: identical replay returns existing receipt; different payload rejects with IDEMPOTENCY_CONFLICT", async () => {
    const f = await fixture("ADMIN");
    const supplier = await createSupplier(f.actor, {
      code: "SUPP-IDEM",
      name: "Proveedor Idem",
    });

    const input = {
      supplierId: supplier.id,
      branchId: f.branchId,
      locationId: f.locationId,
      receiptNumber: "REC-IDEM",
      currency: "XTS",
      idempotencyKey: `idem-replay-${f.tenantId}`,
      lines: [
        {
          variantId: f.variantId,
          quantity: "5",
          unitCost: "20.00",
        },
      ],
    };

    const first = await createDirectPurchaseReceipt(f.actor, input, clock);
    expect(first.id).toBeDefined();

    // Replay with identical payload
    const replay = await createDirectPurchaseReceipt(f.actor, input, clock);
    expect(replay.id).toBe(first.id);

    // Stock should only have been incremented once (5, not 10)
    const level = await admin.inventoryLevel.findFirst({
      where: { tenantId: f.tenantId, locationId: f.locationId, variantId: f.variantId },
    });
    expect(level?.onHand.toFixed(0)).toBe("5");

    // Replay with different payload (conflict)
    const conflictInput = {
      ...input,
      lines: [
        {
          variantId: f.variantId,
          quantity: "99",
          unitCost: "20.00",
        },
      ],
    };
    await expect(createDirectPurchaseReceipt(f.actor, conflictInput, clock)).rejects.toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
  });

  it("leaves stock unchanged when rejected for invalid totals", async () => {
    const f = await fixture("ADMIN");
    const supplier = await createSupplier(f.actor, {
      code: "SUPP-INV",
      name: "Proveedor Invalid",
    });

    const badInput = {
      supplierId: supplier.id,
      branchId: f.branchId,
      locationId: f.locationId,
      currency: "XTS",
      idempotencyKey: `idem-bad-${f.tenantId}`,
      subtotal: "999.00", // Mismatched
      lines: [
        {
          variantId: f.variantId,
          quantity: "5",
          unitCost: "10.00",
        },
      ],
    };

    await expect(createDirectPurchaseReceipt(f.actor, badInput, clock)).rejects.toThrow(
      "INVALID_TOTALS",
    );

    // Stock level remains non-existent or 0
    const level = await admin.inventoryLevel.findFirst({
      where: { tenantId: f.tenantId, locationId: f.locationId, variantId: f.variantId },
    });
    expect(level?.onHand.toFixed(0) ?? "0").toBe("0");
    expect(await admin.purchaseReceipt.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("enforces tenant isolation and leaves stock unchanged on foreign access", async () => {
    const a = await fixture("ADMIN");
    const b = await fixture("ADMIN");

    const supplierB = await createSupplier(b.actor, {
      code: "SUPP-B",
      name: "Proveedor Tenant B",
    });

    // Attempting to use Tenant B's supplier in Tenant A
    const inputWithForeignSupplier = {
      supplierId: supplierB.id,
      branchId: a.branchId,
      locationId: a.locationId,
      currency: "XTS",
      idempotencyKey: `idem-cross-${a.tenantId}`,
      lines: [
        {
          variantId: a.variantId,
          quantity: "5",
          unitCost: "10.00",
        },
      ],
    };

    await expect(createDirectPurchaseReceipt(a.actor, inputWithForeignSupplier, clock)).rejects.toThrow(
      "NOT_FOUND",
    );

    // Attempting to receive into Tenant B's location from Tenant A
    const supplierA = await createSupplier(a.actor, {
      code: "SUPP-A",
      name: "Proveedor Tenant A",
    });

    const inputWithForeignLocation = {
      supplierId: supplierA.id,
      branchId: a.branchId,
      locationId: b.locationId,
      currency: "XTS",
      idempotencyKey: `idem-cross-loc-${a.tenantId}`,
      lines: [
        {
          variantId: a.variantId,
          quantity: "5",
          unitCost: "10.00",
        },
      ],
    };

    await expect(createDirectPurchaseReceipt(a.actor, inputWithForeignLocation, clock)).rejects.toThrow(
      "NOT_FOUND",
    );

    expect(await admin.purchaseReceipt.count({ where: { tenantId: a.tenantId } })).toBe(0);
    expect(await admin.inventoryMovement.count({ where: { tenantId: a.tenantId } })).toBe(0);
  });

  it("rejects unauthorized roles (CASHIER, SUPERVISOR) and leaves stock unchanged", async () => {
    const f = await fixture("ADMIN");
    const supplier = await createSupplier(f.actor, {
      code: "SUPP-ROLE",
      name: "Proveedor Role",
    });

    const cashier = await addActor(f.tenantId, f.branchId, "CASHIER");
    const supervisor = await addActor(f.tenantId, f.branchId, "SUPERVISOR");

    const input = {
      supplierId: supplier.id,
      branchId: f.branchId,
      locationId: f.locationId,
      currency: "XTS",
      idempotencyKey: `idem-cashier-${f.tenantId}`,
      lines: [
        {
          variantId: f.variantId,
          quantity: "5",
          unitCost: "10.00",
        },
      ],
    };

    await expect(createDirectPurchaseReceipt(cashier, input, clock)).rejects.toThrow("FORBIDDEN");
    await expect(createDirectPurchaseReceipt(supervisor, input, clock)).rejects.toThrow("FORBIDDEN");

    expect(await admin.purchaseReceipt.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("rejects quantity exceeding variant precision and leaves stock unchanged", async () => {
    const f = await fixture("ADMIN");
    // Variant created in fixture has quantityPrecision = 0 (UNIT)
    const supplier = await createSupplier(f.actor, {
      code: "SUPP-PREC",
      name: "Proveedor Precision",
    });

    const input = {
      supplierId: supplier.id,
      branchId: f.branchId,
      locationId: f.locationId,
      currency: "XTS",
      idempotencyKey: `idem-prec-${f.tenantId}`,
      lines: [
        {
          variantId: f.variantId,
          quantity: "1.5", // invalid precision for unit variant (precision 0)
          unitCost: "10.00",
        },
      ],
    };

    await expect(createDirectPurchaseReceipt(f.actor, input, clock)).rejects.toThrow(
      "INVALID_QUANTITY_PRECISION",
    );

    expect(await admin.purchaseReceipt.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });
});

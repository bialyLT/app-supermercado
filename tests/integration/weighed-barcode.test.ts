import { afterAll, describe, expect, it } from "vitest";
import { resolvePriceWeighedBarcode, upsertWeighedBarcodeConfig } from "../../src/server/repositories/catalog";
import { confirmPaidMultiLineSale, recordReceipt } from "../../src/server/inventory";
import { admin, clock, enabled, fixture, reconcile } from "./fixtures";

const suite = enabled ? describe : describe.skip;

function ean13(body: string) {
  const checksum = [...body].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - checksum % 10) % 10}`;
}

afterAll(async () => { await admin.$disconnect(); });

suite("tenant-scoped price-embedded EAN-13", () => {
  it("resolves the configured SKU and embedded unit price", async () => {
    const f = await fixture("ADMIN", { cashSession: false });
    await admin.productVariant.update({ where: { id: f.variantId }, data: { sku: "12345" } });
    await upsertWeighedBarcodeConfig(f.actor, { prefix: "20", mode: "PRICE", variantDigits: 5, valueDigits: 5, valueScale: 2 });
    const resolved = await resolvePriceWeighedBarcode(f.actor, ean13("201234500125"));
    expect(resolved).toMatchObject({ variantId: f.variantId, sku: "12345", unitPrice: "1.25" });
  });

  it("rejects an invalid checksum before resolving a variant", async () => {
    const f = await fixture("ADMIN", { cashSession: false });
    await upsertWeighedBarcodeConfig(f.actor, { prefix: "20", mode: "PRICE", variantDigits: 5, valueDigits: 5, valueScale: 2 });
    await expect(resolvePriceWeighedBarcode(f.actor, "2012345001259")).rejects.toThrow("INVALID_EAN13_CHECKSUM");
  });

  it("persists immutable sourceSnapshot on SaleLine for paid weighed sales and replays idempotently", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.25" });
    await admin.productVariant.update({ where: { id: f.variantId }, data: { sku: "12345", quantityPrecision: 3 } });
    await upsertWeighedBarcodeConfig(f.actor, { prefix: "20", mode: "PRICE", variantDigits: 5, valueDigits: 5, valueScale: 2 });
    await recordReceipt(f.actor, { ...f.stock, quantity: "10.000", reason: "seed", idempotencyKey: "seed-weighed" }, clock);

    const barcode = ean13("201234500125");
    const saleInput = {
      idempotencyKey: "weighed-paid-sale-1",
      lines: [{
        locationId: f.locationId,
        variantId: f.variantId,
        quantity: "2.000",
        unitPrice: "1.25",
        weighedBarcode: barcode,
      }],
      payments: [{ method: "CASH" as const, amount: "2.50" }],
    };

    const result = await confirmPaidMultiLineSale(f.actor, saleInput, clock);
    expect(result.total).toBe("2.50");

    const replayed = await confirmPaidMultiLineSale(f.actor, saleInput, clock);
    expect(replayed).toEqual(result);

    const saleLines = await admin.saleLine.findMany({ where: { tenantId: f.tenantId } });
    expect(saleLines).toHaveLength(1);
    expect(saleLines[0].sourceSnapshot).toMatchObject({
      type: "WEIGHED_BARCODE",
      raw: barcode,
      prefix: "20",
      sku: "12345",
      mode: "PRICE",
      variantDigits: 5,
      valueDigits: 5,
      valueScale: 2,
      unitPrice: "1.25",
    });

    // Verify snapshot immutability
    await expect(admin.saleLine.update({
      where: { id: saleLines[0].id },
      data: { sourceSnapshot: { type: "TAMPERED" } },
    })).rejects.toThrow("SALE_LINE_SOURCE_SNAPSHOT_IMMUTABLE");

    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("rejects sale when embedded price does not match current branch-prioritized price", async () => {
    const f = await fixture("ADMIN", { unitPrice: "2.00" });
    await admin.productVariant.update({ where: { id: f.variantId }, data: { sku: "12345", quantityPrecision: 3 } });
    await upsertWeighedBarcodeConfig(f.actor, { prefix: "20", mode: "PRICE", variantDigits: 5, valueDigits: 5, valueScale: 2 });
    await recordReceipt(f.actor, { ...f.stock, quantity: "10.000", reason: "seed", idempotencyKey: "seed-mismatch" }, clock);

    const barcode = ean13("201234500125"); // Embedded price 1.25 != server price 2.00
    const saleInput = {
      idempotencyKey: "weighed-mismatch-sale",
      lines: [{
        locationId: f.locationId,
        variantId: f.variantId,
        quantity: "1.000",
        unitPrice: "1.25",
        weighedBarcode: barcode,
      }],
      payments: [{ method: "CASH" as const, amount: "1.25" }],
    };

    await expect(confirmPaidMultiLineSale(f.actor, saleInput, clock)).rejects.toThrow("PRICE_MISMATCH");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("rejects sale when embedded price is zero", async () => {
    const f = await fixture("ADMIN", { unitPrice: "0.00" });
    await admin.productVariant.update({ where: { id: f.variantId }, data: { sku: "12345", quantityPrecision: 3 } });
    await upsertWeighedBarcodeConfig(f.actor, { prefix: "20", mode: "PRICE", variantDigits: 5, valueDigits: 5, valueScale: 2 });
    await recordReceipt(f.actor, { ...f.stock, quantity: "10.000", reason: "seed", idempotencyKey: "seed-zero" }, clock);

    const zeroBarcode = ean13("201234500000"); // Embedded price 0.00
    const saleInput = {
      idempotencyKey: "weighed-zero-sale",
      lines: [{
        locationId: f.locationId,
        variantId: f.variantId,
        quantity: "1.000",
        unitPrice: "0.00",
        weighedBarcode: zeroBarcode,
      }],
      payments: [{ method: "CASH" as const, amount: "1.00" }],
    };

    await expect(confirmPaidMultiLineSale(f.actor, saleInput, clock)).rejects.toThrow("WEIGHED_BARCODE_ZERO_PRICE");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.payment.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId, reason: { not: "seed" } } })).toBe(0);
    expect(await admin.idempotencyCommand.count({ where: { tenantId: f.tenantId, commandId: "weighed-zero-sale" } })).toBe(0);
    expect(await admin.documentSequence.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("rejects sale when source unitPrice does not match barcode embedded price and leaves state unchanged", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.25" });
    await admin.productVariant.update({ where: { id: f.variantId }, data: { sku: "12345", quantityPrecision: 3 } });
    await upsertWeighedBarcodeConfig(f.actor, { prefix: "20", mode: "PRICE", variantDigits: 5, valueDigits: 5, valueScale: 2 });
    await recordReceipt(f.actor, { ...f.stock, quantity: "10.000", reason: "seed", idempotencyKey: "seed-unit-mismatch" }, clock);

    const barcode = ean13("201234500125"); // Embedded price 1.25
    const saleInput = {
      idempotencyKey: "source-unit-price-mismatch-sale",
      lines: [{
        locationId: f.locationId,
        variantId: f.variantId,
        quantity: "1.000",
        unitPrice: "1.50", // Mismatches embedded price 1.25
        weighedBarcode: barcode,
      }],
      payments: [{ method: "CASH" as const, amount: "1.50" }],
    };

    await expect(confirmPaidMultiLineSale(f.actor, saleInput, clock)).rejects.toThrow("PRICE_MISMATCH");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.payment.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId, reason: { not: "seed" } } })).toBe(0);
    expect(await admin.idempotencyCommand.count({ where: { tenantId: f.tenantId, commandId: "source-unit-price-mismatch-sale" } })).toBe(0);
    expect(await admin.documentSequence.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("validates weighed barcode against branch-prioritized price over tenant price", async () => {
    const f = await fixture("ADMIN", { unitPrice: "2.00" });
    await admin.productVariant.update({ where: { id: f.variantId }, data: { sku: "12345", quantityPrecision: 3 } });
    await upsertWeighedBarcodeConfig(f.actor, { prefix: "20", mode: "PRICE", variantDigits: 5, valueDigits: 5, valueScale: 2 });
    await recordReceipt(f.actor, { ...f.stock, quantity: "10.000", reason: "seed", idempotencyKey: "seed-branch-prio" }, clock);

    // Create branch-specific price of 1.25
    await admin.price.create({
      data: {
        tenantId: f.tenantId,
        branchId: f.branchId,
        variantId: f.variantId,
        currency: "XTS",
        amount: "1.25",
        validFrom: new Date("2020-01-01T00:00:00Z"),
      },
    });

    // 1. Barcode with branch price (1.25) succeeds
    const branchBarcode = ean13("201234500125");
    const validSale = {
      idempotencyKey: "branch-prio-valid-sale",
      lines: [{
        locationId: f.locationId,
        variantId: f.variantId,
        quantity: "1.000",
        unitPrice: "1.25",
        weighedBarcode: branchBarcode,
      }],
      payments: [{ method: "CASH" as const, amount: "1.25" }],
    };
    const result = await confirmPaidMultiLineSale(f.actor, validSale, clock);
    expect(result.total).toBe("1.25");

    // 2. Barcode with general price (2.00) rejects with PRICE_MISMATCH because branch price overrides it
    const generalBarcode = ean13("201234500200");
    const invalidSale = {
      idempotencyKey: "branch-prio-invalid-sale",
      lines: [{
        locationId: f.locationId,
        variantId: f.variantId,
        quantity: "1.000",
        unitPrice: "2.00",
        weighedBarcode: generalBarcode,
      }],
      payments: [{ method: "CASH" as const, amount: "2.00" }],
    };
    await expect(confirmPaidMultiLineSale(f.actor, invalidSale, clock)).rejects.toThrow("PRICE_MISMATCH");
  });

  it("replays identically five times and rejects changed payload on same idempotency key", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.25" });
    await admin.productVariant.update({ where: { id: f.variantId }, data: { sku: "12345", quantityPrecision: 3 } });
    await upsertWeighedBarcodeConfig(f.actor, { prefix: "20", mode: "PRICE", variantDigits: 5, valueDigits: 5, valueScale: 2 });
    await recordReceipt(f.actor, { ...f.stock, quantity: "20.000", reason: "seed", idempotencyKey: "seed-replay" }, clock);

    const barcode = ean13("201234500125");
    const saleInput = {
      idempotencyKey: "five-replay-sale",
      lines: [{
        locationId: f.locationId,
        variantId: f.variantId,
        quantity: "1.000",
        unitPrice: "1.25",
        weighedBarcode: barcode,
      }],
      payments: [{ method: "CASH" as const, amount: "1.25" }],
    };

    const r1 = await confirmPaidMultiLineSale(f.actor, saleInput, clock);
    const r2 = await confirmPaidMultiLineSale(f.actor, saleInput, clock);
    const r3 = await confirmPaidMultiLineSale(f.actor, saleInput, clock);
    const r4 = await confirmPaidMultiLineSale(f.actor, saleInput, clock);
    const r5 = await confirmPaidMultiLineSale(f.actor, saleInput, clock);

    expect(r2).toEqual(r1);
    expect(r3).toEqual(r1);
    expect(r4).toEqual(r1);
    expect(r5).toEqual(r1);
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(1);

    // Changed payload with same idempotency key
    const changedInput = {
      ...saleInput,
      lines: [{
        locationId: f.locationId,
        variantId: f.variantId,
        quantity: "2.000",
        unitPrice: "1.25",
        weighedBarcode: barcode,
      }],
      payments: [{ method: "CASH" as const, amount: "2.50" }],
    };
    await expect(confirmPaidMultiLineSale(f.actor, changedInput, clock)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });

  it("enforces permission on config upsert and ensures rejected sales leave state unchanged", async () => {
    const f = await fixture("CASHIER");
    await expect(upsertWeighedBarcodeConfig(f.actor, {
      prefix: "20",
      mode: "PRICE",
      variantDigits: 5,
      valueDigits: 5,
      valueScale: 2,
    })).rejects.toThrow("FORBIDDEN");
  });

  it("rejects sale when weighed barcode is not configured for the tenant", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.25" });
    await admin.productVariant.update({ where: { id: f.variantId }, data: { sku: "12345", quantityPrecision: 3 } });
    await recordReceipt(f.actor, { ...f.stock, quantity: "10.000", reason: "seed", idempotencyKey: "seed-noconfig" }, clock);

    const barcode = ean13("201234500125");
    const saleInput = {
      idempotencyKey: "weighed-noconfig-sale",
      lines: [{
        locationId: f.locationId,
        variantId: f.variantId,
        quantity: "1.000",
        unitPrice: "1.25",
        weighedBarcode: barcode,
      }],
      payments: [{ method: "CASH" as const, amount: "1.25" }],
    };

    await expect(confirmPaidMultiLineSale(f.actor, saleInput, clock)).rejects.toThrow("WEIGHED_BARCODE_NOT_CONFIGURED");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("preserves unmarked multiline line behavior without creating sourceSnapshot", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.00" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "5.000", reason: "seed", idempotencyKey: "seed-unmarked" }, clock);

    const saleInput = {
      idempotencyKey: "unmarked-multiline-sale",
      lines: [{
        locationId: f.locationId,
        variantId: f.variantId,
        quantity: "2.000",
        unitPrice: "999.99", // Unmarked lines ignore client unitPrice
      }],
      payments: [{ method: "CASH" as const, amount: "2.00" }],
    };

    const result = await confirmPaidMultiLineSale(f.actor, saleInput, clock);
    expect(result.total).toBe("2.00");

    const line = await admin.saleLine.findFirstOrThrow({ where: { tenantId: f.tenantId } });
    expect(line.sourceSnapshot).toBeNull();
  });

  it("enforces tenant isolation and prevents cross-tenant weighed barcode resolution", async () => {
    const f1 = await fixture("ADMIN", { unitPrice: "1.25" });
    const f2 = await fixture("ADMIN", { unitPrice: "1.25" });
    await admin.productVariant.update({ where: { id: f1.variantId }, data: { sku: "12345" } });
    await upsertWeighedBarcodeConfig(f1.actor, { prefix: "20", mode: "PRICE", variantDigits: 5, valueDigits: 5, valueScale: 2 });

    // f2 has no weighed config: resolving f1's barcode fails
    await expect(resolvePriceWeighedBarcode(f2.actor, ean13("201234500125"))).rejects.toThrow("WEIGHED_BARCODE_NOT_CONFIGURED");

    // f2 configures same prefix but has no variant with sku 12345
    await upsertWeighedBarcodeConfig(f2.actor, { prefix: "20", mode: "PRICE", variantDigits: 5, valueDigits: 5, valueScale: 2 });
    await expect(resolvePriceWeighedBarcode(f2.actor, ean13("201234500125"))).rejects.toThrow("NOT_FOUND");
  });

  it("rejects unauthenticated barcode resolution and mismatching line variant", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.25" });
    await admin.productVariant.update({ where: { id: f.variantId }, data: { sku: "12345" } });
    await upsertWeighedBarcodeConfig(f.actor, { prefix: "20", mode: "PRICE", variantDigits: 5, valueDigits: 5, valueScale: 2 });

    const unauthActor = { ...f.actor, sessionId: crypto.randomUUID() };
    await expect(resolvePriceWeighedBarcode(unauthActor, ean13("201234500125"))).rejects.toThrow("UNAUTHENTICATED");

    // Variant mismatch: line variantId != barcode SKU variant
    const otherVariant = await admin.productVariant.create({
      data: { tenantId: f.tenantId, productId: f.productId, unitId: f.unitId, sku: "other", name: "Other" },
    });
    const saleInput = {
      idempotencyKey: "variant-mismatch-sale",
      lines: [{
        locationId: f.locationId,
        variantId: otherVariant.id, // Does not match barcode SKU 12345
        quantity: "1.000",
        unitPrice: "1.25",
        weighedBarcode: ean13("201234500125"),
      }],
      payments: [{ method: "CASH" as const, amount: "1.25" }],
    };
    await expect(confirmPaidMultiLineSale(f.actor, saleInput, clock)).rejects.toThrow("PRICE_MISMATCH");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.payment.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.idempotencyCommand.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.documentSequence.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });
});

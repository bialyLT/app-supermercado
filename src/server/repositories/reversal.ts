import Decimal from "decimal.js";
import type { Actor } from "../../domain/actor";
import { FinancialDecimal, money } from "../../domain/cash";
import { InventoryError, assertQuantityPrecision } from "../../domain/inventory";
import { reversalLineTotal, type ReversalInput } from "../../domain/reversal";
import { audit, command, inventoryTransaction } from "./inventory";
import { currentRegisterSession } from "./cash";
import { allocateDocumentNumber } from "./numbering";
import type { Clock } from "./inventory";
export async function reverse(actor: Actor, input: ReversalInput, clock: Clock) {
  return inventoryTransaction(actor, "inventory.sale.approve", clock, async (tx, verified, now) => {
    const sale = await tx.sale.findFirst({ where: { tenantId: verified.tenantId, id: input.saleId }, include: { lines: true } });
    if (!sale || !sale.registerSessionId || !sale.currency) throw new InventoryError("NOT_FOUND");
    const location = await tx.location.findFirst({ where: { tenantId: verified.tenantId, id: sale.locationId, branchId: { in: [...verified.branchIds] } } });
    if (!location?.branchId || !sale.currency) throw new InventoryError("NOT_FOUND");
    const currency = sale.currency;
    const branchId = location.branchId;
    const active = await currentRegisterSession(tx, verified, location.branchId);
    if (active.currency !== currency) throw new InventoryError("CURRENCY_MISMATCH");
    const originalSession = await tx.cashRegisterSession.findFirst({ where: { tenantId: verified.tenantId, id: sale.registerSessionId, branchId: location.branchId } });
    if (!originalSession || originalSession.currency !== currency) throw new InventoryError("CURRENCY_MISMATCH");

    return command(tx, verified, "SALE_REVERSAL", input, async () => {
      const prior = await tx.saleReversalLine.findMany({ where: { tenantId: verified.tenantId, saleLine: { saleId: sale.id } } });
      const reversed = new Map<string, Decimal>();
      for (const line of prior) reversed.set(line.saleLineId, (reversed.get(line.saleLineId) ?? new Decimal(0)).plus(line.quantity.toString()));
      const originalById = new Map(sale.lines.map((line) => [line.id, line]));
      const variants = await tx.productVariant.findMany({ where: { tenantId: verified.tenantId, id: { in: sale.lines.map((line) => line.variantId) } } });
      const variantById = new Map(variants.map((variant) => [variant.id, variant]));
      if (input.type === "ANNULMENT" && input.lines.length !== sale.lines.length) throw new InventoryError("ANNULMENT_REQUIRES_FULL_SALE");
      if (input.type === "ANNULMENT" && input.lines.some((line) => !originalById.has(line.saleLineId))) throw new InventoryError("ANNULMENT_REQUIRES_FULL_SALE");
      const selected = input.lines.map((line) => {
        const original = originalById.get(line.saleLineId);
        if (!original) throw new InventoryError("NOT_FOUND");
        const variant = variantById.get(original.variantId);
        if (!variant) throw new InventoryError("NOT_FOUND");
        assertQuantityPrecision(line.quantity, variant.quantityPrecision);
        const requested = new Decimal(line.quantity);
        const remaining = new Decimal(original.quantity.toString()).minus(reversed.get(original.id) ?? 0);
        if (requested.gt(remaining)) throw new InventoryError("REVERSAL_QUANTITY_EXCEEDED");
        if (!requested.equals(original.quantity.toString())) throw new InventoryError("PARTIAL_RETURN_UNSUPPORTED");
        if (input.type === "ANNULMENT" && !requested.equals(original.quantity.toString())) throw new InventoryError("ANNULMENT_REQUIRES_FULL_SALE");
        return { original, quantity: requested };
      });
      if (input.type === "ANNULMENT" && selected.some(({ original }) => (reversed.get(original.id) ?? new Decimal(0)).gt(0))) throw new InventoryError("REVERSAL_QUANTITY_EXCEEDED");
      const total = selected.reduce((sum, line) => sum.plus(reversalLineTotal(line.quantity.toString(), line.original.unitPrice.toString(), currency)), new FinancialDecimal(0));
      const documentNumber = await allocateDocumentNumber(tx, verified.tenantId, branchId, input.type);
      const reversal = await tx.saleReversal.create({ data: {
        tenantId: verified.tenantId, saleId: sale.id, branchId, registerSessionId: originalSession.id,
        type: input.type, actorUserId: verified.userId, reason: input.reason, idempotencyKey: input.idempotencyKey,
        total: money(total, currency), currency, documentNumber, createdAt: now,
      } });

      for (const selectedLine of selected) {
        const { original, quantity } = selectedLine;
        await tx.saleReversalLine.create({ data: { tenantId: verified.tenantId, reversalId: reversal.id, saleLineId: original.id,
          quantity: quantity.toString(), unitPrice: original.unitPrice, total: reversalLineTotal(quantity.toString(), original.unitPrice.toString(), currency) } });
        const movements = await tx.inventoryMovement.findMany({ where: { tenantId: verified.tenantId, referenceId: sale.id, type: "SALE", direction: "OUT", variantId: original.variantId, locationId: sale.locationId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
        const already = reversed.get(original.id) ?? new Decimal(0);
        let skip = already;
        let remaining = quantity;
        for (const movement of movements) {
          if (skip.gte(movement.quantity.toString())) { skip = skip.minus(movement.quantity.toString()); continue; }
          const available = new Decimal(movement.quantity.toString()).minus(skip);
          const restored = Decimal.min(available, remaining);
          const level = await tx.inventoryLevel.findFirst({ where: { tenantId: verified.tenantId, locationId: movement.locationId, variantId: movement.variantId, lotId: movement.lotId } })
            ?? await tx.inventoryLevel.create({ data: { tenantId: verified.tenantId, locationId: movement.locationId, variantId: movement.variantId, lotId: movement.lotId, onHand: "0", reserved: "0" } });
          await tx.inventoryLevel.update({ where: { id: level.id }, data: { onHand: { increment: restored.toString() } } });
          await tx.inventoryMovement.create({ data: { tenantId: verified.tenantId, locationId: movement.locationId, variantId: movement.variantId, lotId: movement.lotId,
            quantity: restored.toString(), direction: "IN", type: "RETURN", referenceId: reversal.id, registerSessionId: originalSession.id,
            actorUserId: verified.userId, reason: input.reason } });
          remaining = remaining.minus(restored);
          skip = new Decimal(0);
          if (remaining.isZero()) break;
        }
        if (!remaining.isZero()) throw new InventoryError("REVERSAL_STOCK_TRACE_MISSING");
      }
      await tx.cashMovement.create({ data: { tenantId: verified.tenantId, registerSessionId: originalSession.id, type: "CASH_OUT",
        amount: money(total, currency), currency, actorUserId: verified.userId, reason: input.reason, referenceId: reversal.id, createdAt: now } });
      await audit(tx, verified, "sale.reversed", "SaleReversal", reversal.id, { saleId: sale.id, type: input.type, total: money(total, currency), currency, documentNumber, reason: input.reason });
      return { id: reversal.id, type: input.type, total: money(total, currency), currency, documentNumber };
    });
  });
}

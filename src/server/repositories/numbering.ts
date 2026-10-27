import type { Actor } from "../../domain/actor";
import { FinancialDecimal, currencyPrecision, money } from "../../domain/cash";
import { InventoryError } from "../../domain/inventory";
import { assertContinuous, reconcileDocumentTotals, type ClosureInput, type DocumentType } from "../../domain/numbering";
import { audit, command, inventoryTransaction, type Clock } from "./inventory";
import type { TransactionClient as Tx } from "./tenant-context";

export async function allocateDocumentNumber(tx: Tx, tenantId: string, branchId: string, kind: DocumentType): Promise<number> {
  await tx.documentSequence.upsert({
    where: { tenantId_branchId_documentType: { tenantId, branchId, documentType: kind } },
    create: { tenantId, branchId, documentType: kind, lastNumber: 0 },
    update: {},
  });
  // Row lock plus the tenant advisory lock in inventoryTransaction serializes
  // allocation; the increment lives in the creating transaction, so a rollback
  // consumes nothing and committed numbers stay strictly increasing.
  const locked = await tx.$queryRaw<{ lastNumber: number }[]>`
    SELECT "lastNumber" FROM "DocumentSequence"
    WHERE "tenantId" = ${tenantId}::uuid AND "branchId" = ${branchId}::uuid
      AND "documentType" = CAST(${kind} AS "DocumentType") FOR UPDATE`;
  let next = Number(locked[0]?.lastNumber ?? 0) + 1;
  if (kind === "SALE") {
    const legacy = await tx.$queryRaw<{ id: string }[]>`
      SELECT s."id" FROM "Sale" s
      JOIN "Location" l ON l."id" = s."locationId" AND l."tenantId" = s."tenantId"
      WHERE s."tenantId" = ${tenantId}::uuid AND l."branchId" = ${branchId}::uuid
        AND s."documentNumber" IS NULL
      ORDER BY s."createdAt" ASC, s."id" ASC`;
    for (const doc of legacy) {
      await tx.$executeRaw`UPDATE "Sale" SET "documentNumber" = ${next}, "branchId" = ${branchId}::uuid
        WHERE "id" = ${doc.id}::uuid AND "tenantId" = ${tenantId}::uuid`;
      next += 1;
    }
  } else {
    const legacy = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "SaleReversal"
      WHERE "tenantId" = ${tenantId}::uuid AND "branchId" = ${branchId}::uuid
        AND "type" = CAST(${kind} AS "SaleReversalType") AND "documentNumber" IS NULL
      ORDER BY "createdAt" ASC, "id" ASC`;
    for (const doc of legacy) {
      await tx.$executeRaw`UPDATE "SaleReversal" SET "documentNumber" = ${next}
        WHERE "id" = ${doc.id}::uuid AND "tenantId" = ${tenantId}::uuid`;
      next += 1;
    }
  }
  await tx.$executeRaw`UPDATE "DocumentSequence" SET "lastNumber" = ${next}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = ${tenantId}::uuid AND "branchId" = ${branchId}::uuid
      AND "documentType" = CAST(${kind} AS "DocumentType")`;
  return next;
}

function sum(values: string[]) {
  return values.reduce((total, value) => total.plus(value), new FinancialDecimal(0));
}

export async function closeDocuments(actor: Actor, input: ClosureInput, clock: Clock) {
  return inventoryTransaction(actor, "inventory.sale.approve", clock, async (tx, verified, now) => {
    if (!verified.branchIds.includes(input.branchId)) throw new InventoryError("NOT_FOUND");
    return command(tx, verified, "DOCUMENT_CLOSE", input, async () => {
      const sales = await tx.sale.findMany({ where: { tenantId: verified.tenantId, branchId: input.branchId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      const reversals = await tx.saleReversal.findMany({ where: { tenantId: verified.tenantId, branchId: input.branchId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      for (const doc of [...sales, ...reversals])
        if (!doc.currency || doc.currency !== input.currency) throw new InventoryError("CURRENCY_MISMATCH");
      const saleCheck = assertContinuous(sales.map((sale) => sale.documentNumber));
      const annulments = reversals.filter((reversal) => reversal.type === "ANNULMENT");
      const returns = reversals.filter((reversal) => reversal.type === "RETURN");
      const annulmentCheck = assertContinuous(annulments.map((reversal) => reversal.documentNumber));
      const returnCheck = assertContinuous(returns.map((reversal) => reversal.documentNumber));

      const saleTotal = money(sum(sales.map((sale) => sale.total.toString())), input.currency);
      const annulmentTotal = money(sum(annulments.map((reversal) => reversal.total.toString())), input.currency);
      const returnTotal = money(sum(returns.map((reversal) => reversal.total.toString())), input.currency);
      const payments = await tx.payment.findMany({ where: { tenantId: verified.tenantId,
        currency: input.currency, sale: { branchId: input.branchId } } });
      const movements = await tx.cashMovement.findMany({ where: { tenantId: verified.tenantId,
        registerSession: { branchId: input.branchId }, type: { in: ["CASH_IN", "CASH_OUT"] } } });
      for (const movement of movements)
        if (movement.currency !== input.currency) throw new InventoryError("CURRENCY_MISMATCH");
      const paymentsTotal = money(sum(payments.map((payment) => payment.amount.toString())), input.currency);
      const movementsIn = money(sum(movements.filter((movement) => movement.type === "CASH_IN").map((movement) => movement.amount.toString())), input.currency);
      const movementsOut = money(sum(movements.filter((movement) => movement.type === "CASH_OUT").map((movement) => movement.amount.toString())), input.currency);

      // Reconciliation: document net (sales minus annulments/returns) must equal
      // the recorded money flows (exact-total payments plus manual CASH_IN minus
      // CASH_OUT, including the auditable CASH_OUT each reversal creates).
      // Till-float declarations (OPENING, CLOSING_COUNT) are out of scope.
      const places = currencyPrecision(input.currency);
      const documentNet = new FinancialDecimal(saleTotal).minus(annulmentTotal).minus(returnTotal);
      const cashNet = new FinancialDecimal(paymentsTotal).plus(movementsIn).minus(movementsOut);
      const netTotal = reconcileDocumentTotals(documentNet, cashNet, input.currency);
      const cashTotal = cashNet.toDecimalPlaces(places).toFixed(places);

      const closure = await tx.documentClosure.create({ data: { tenantId: verified.tenantId, branchId: input.branchId,
        currency: input.currency, reason: input.reason, idempotencyKey: input.idempotencyKey, actorUserId: verified.userId,
        saleCount: saleCheck.count, saleTotal, saleMax: saleCheck.max,
        annulmentCount: annulmentCheck.count, annulmentTotal, annulmentMax: annulmentCheck.max,
        returnCount: returnCheck.count, returnTotal, returnMax: returnCheck.max,
        paymentsTotal, movementsIn, movementsOut, cashTotal, netTotal, createdAt: now } });
      await audit(tx, verified, "document.closed", "DocumentClosure", closure.id,
        { branchId: input.branchId, currency: input.currency, saleCount: saleCheck.count, saleMax: saleCheck.max,
          annulmentCount: annulmentCheck.count, returnCount: returnCheck.count,
          netTotal, cashTotal, reason: input.reason });
      return { id: closure.id, type: "DOCUMENT_CLOSE", total: netTotal, currency: input.currency };
    });
  });
}

import Decimal from "decimal.js";
import type { Actor } from "../../domain/actor";
import { FinancialDecimal } from "../../domain/cash";
import { ReportError, operationsReportQuerySchema, type OperationsReportQuery } from "../../domain/reports";
import { prisma } from "./client";
import { withTenant } from "./tenant-context";

export type BranchReport = {
  branchId: string;
  salesCount: number;
  salesTotal: string;
  purchaseCount: number;
  purchaseTotal: string;
  transferOutQuantity: string;
  transferInQuantity: string;
  stockQuantity: string;
};

export type ReportFilterSources = {
  actors: Array<{ id: string; label: string }>;
  variants: Array<{ id: string; label: string }>;
  categories: Array<{ id: string; label: string }>;
};

export async function reportFilterSources(actor: Actor): Promise<ReportFilterSources> {
  return withTenant(prisma, actor, async (tx) => {
    const branchFilter = actor.role === "ADMIN" && actor.branchIds.length === 0
      ? undefined
      : { some: { branchId: { in: [...actor.branchIds] } } };
    const [users, variants, categories] = await Promise.all([
      tx.user.findMany({ where: { tenantId: actor.tenantId, active: true, ...(branchFilter ? { branches: branchFilter } : {}) }, select: { id: true, displayName: true, email: true }, orderBy: { displayName: "asc" }, take: 200 }),
      tx.productVariant.findMany({ where: { tenantId: actor.tenantId, active: true }, select: { id: true, sku: true, name: true, product: { select: { name: true } } }, orderBy: { sku: "asc" }, take: 500 }),
      tx.productCategory.findMany({ where: { tenantId: actor.tenantId, active: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" }, take: 200 }),
    ]);
    return {
      actors: users.map((user) => ({ id: user.id, label: `${user.displayName} (${user.email})` })),
      variants: variants.map((variant) => ({ id: variant.id, label: `${variant.sku} - ${variant.product.name} (${variant.name})` })),
      categories: categories.map((category) => ({ id: category.id, label: `${category.code} - ${category.name}` })),
    };
  });
}

export type OperationsReport = {
  period: { from: string; to: string };
  filters: Omit<OperationsReportQuery, "format">;
  currency: string | null;
  sales: { count: number; total: string; quantity: string };
  purchases: { count: number; total: string; taxTotal: string; discountTotal: string; quantity: string };
  transfers: { count: number; outQuantity: string; inQuantity: string };
  stock: { lineCount: number; quantity: string };
  branches: BranchReport[];
};

type BranchAccumulator = {
  salesCount: number;
  salesTotal: Decimal;
  purchaseCount: number;
  purchaseTotal: Decimal;
  transferOutQuantity: Decimal;
  transferInQuantity: Decimal;
  stockQuantity: Decimal;
};

function branchAccumulator(): BranchAccumulator {
  return {
    salesCount: 0,
    salesTotal: new FinancialDecimal(0),
    purchaseCount: 0,
    purchaseTotal: new FinancialDecimal(0),
    transferOutQuantity: new FinancialDecimal(0),
    transferInQuantity: new FinancialDecimal(0),
    stockQuantity: new FinancialDecimal(0),
  };
}

function addBranch(map: Map<string, BranchAccumulator>, branchId: string): BranchAccumulator {
  const current = map.get(branchId) ?? branchAccumulator();
  map.set(branchId, current);
  return current;
}

function lineMatches(line: { variantId: string; variant: { product: { categoryId: string | null } } }, query: OperationsReportQuery): boolean {
  return (!query.variantId || line.variantId === query.variantId) && (!query.categoryId || line.variant.product.categoryId === query.categoryId);
}

function decimal(value: Decimal.Value): Decimal {
  return new FinancialDecimal(value);
}

export async function operationsReport(actor: Actor, query: OperationsReportQuery): Promise<OperationsReport> {
  const parsed = operationsReportQuerySchema.parse(query);
  const from = new Date(parsed.from);
  const to = new Date(parsed.to);
  if (to <= from) throw new ReportError("INVALID_PERIOD");
  const assignedBranches = actor.role === "ADMIN" ? undefined : actor.branchIds;
  if (parsed.branchId && assignedBranches && !assignedBranches.includes(parsed.branchId)) throw new ReportError("FORBIDDEN");
  const branchScope = parsed.branchId ?? (assignedBranches ? { in: [...assignedBranches] } : undefined);
  const transferScope = parsed.branchId
    ? { OR: [{ originBranchId: parsed.branchId }, { destinationBranchId: parsed.branchId }] }
    : assignedBranches
      ? { OR: [{ originBranchId: { in: [...assignedBranches] } }, { destinationBranchId: { in: [...assignedBranches] } }] }
      : {};

  return withTenant(prisma, actor, async (tx) => {
    const sales = await tx.sale.findMany({
      where: {
        tenantId: actor.tenantId,
        createdAt: { gte: from, lt: to },
        branchId: branchScope,
        actorUserId: parsed.actorUserId,
        ...(parsed.variantId || parsed.categoryId ? {
          lines: { some: { variantId: parsed.variantId, variant: { product: { categoryId: parsed.categoryId } } } },
        } : {}),
      },
      include: { lines: { include: { variant: { include: { product: { select: { categoryId: true } } } } } } },
    });
    const purchases = await tx.purchaseReceipt.findMany({
      where: {
        tenantId: actor.tenantId,
        receivedAt: { gte: from, lt: to },
        branchId: branchScope,
        actorUserId: parsed.actorUserId,
        ...(parsed.variantId || parsed.categoryId ? {
          lines: { some: { variantId: parsed.variantId, variant: { product: { categoryId: parsed.categoryId } } } },
        } : {}),
      },
      include: { lines: { include: { variant: { include: { product: { select: { categoryId: true } } } } } } },
    });
    const transfers = await tx.inventoryTransfer.findMany({
      where: {
        tenantId: actor.tenantId,
        createdAt: { gte: from, lt: to },
        actorUserId: parsed.actorUserId,
        ...transferScope,
        ...(parsed.variantId || parsed.categoryId ? {
          lines: { some: { variantId: parsed.variantId, variant: { product: { categoryId: parsed.categoryId } } } },
        } : {}),
      },
      include: {
        lines: { include: { variant: { include: { product: { select: { categoryId: true } } } } } },
      },
    });
    const levels = await tx.inventoryLevel.findMany({
      where: {
        tenantId: actor.tenantId,
        location: { branchId: branchScope },
        variantId: parsed.variantId,
        ...(parsed.categoryId ? { variant: { product: { categoryId: parsed.categoryId } } } : {}),
      },
      include: { location: { select: { branchId: true } }, variant: { include: { product: { select: { categoryId: true } } } } },
    });

    const branches = new Map<string, BranchAccumulator>();
    let salesTotal = decimal(0);
    let salesQuantity = decimal(0);
    let purchaseTotal = decimal(0);
    let purchaseTax = decimal(0);
    let purchaseDiscount = decimal(0);
    let purchaseQuantity = decimal(0);
    let transferOut = decimal(0);
    let transferIn = decimal(0);
    let stockQuantity = decimal(0);
    let currency: string | null = null;

    for (const sale of sales) {
      const matchingLines = sale.lines.filter((line) => lineMatches(line, parsed));
      if (matchingLines.length === 0) continue;
      salesTotal = salesTotal.plus(sale.total.toString());
      salesQuantity = salesQuantity.plus(matchingLines.reduce((sum, line) => sum.plus(line.quantity.toString()), decimal(0)));
      const branch = sale.branchId ? addBranch(branches, sale.branchId) : null;
      if (branch) {
        branch.salesCount += 1;
        branch.salesTotal = branch.salesTotal.plus(sale.total.toString());
      }
      currency ??= sale.currency;
    }

    for (const purchase of purchases) {
      const matchingLines = purchase.lines.filter((line) => lineMatches(line, parsed));
      if (matchingLines.length === 0) continue;
      purchaseTotal = purchaseTotal.plus(purchase.total.toString());
      purchaseTax = purchaseTax.plus(purchase.taxTotal.toString());
      purchaseDiscount = purchaseDiscount.plus(purchase.discountTotal.toString());
      purchaseQuantity = purchaseQuantity.plus(matchingLines.reduce((sum, line) => sum.plus(line.quantity.toString()), decimal(0)));
      const branch = addBranch(branches, purchase.branchId);
      branch.purchaseCount += 1;
      branch.purchaseTotal = branch.purchaseTotal.plus(purchase.total.toString());
      currency ??= purchase.currency;
    }

    for (const transfer of transfers) {
      const matchingLines = transfer.lines.filter((line) => lineMatches(line, parsed));
      if (matchingLines.length === 0) continue;
      const quantity = matchingLines.reduce((sum, line) => sum.plus(line.quantity.toString()), decimal(0));
      transferOut = transferOut.plus(quantity);
      transferIn = transferIn.plus(quantity);
      addBranch(branches, transfer.originBranchId).transferOutQuantity = addBranch(branches, transfer.originBranchId).transferOutQuantity.plus(quantity);
      addBranch(branches, transfer.destinationBranchId).transferInQuantity = addBranch(branches, transfer.destinationBranchId).transferInQuantity.plus(quantity);
    }

    for (const level of levels) {
      if (parsed.categoryId && level.variant.product.categoryId !== parsed.categoryId) continue;
      stockQuantity = stockQuantity.plus(level.onHand.toString());
      if (level.location.branchId) addBranch(branches, level.location.branchId).stockQuantity = addBranch(branches, level.location.branchId).stockQuantity.plus(level.onHand.toString());
    }

    return {
      period: { from: parsed.from, to: parsed.to },
      filters: { from: parsed.from, to: parsed.to, branchId: parsed.branchId, actorUserId: parsed.actorUserId, variantId: parsed.variantId, categoryId: parsed.categoryId },
      currency,
      sales: { count: sales.length, total: salesTotal.toFixed(2), quantity: salesQuantity.toString() },
      purchases: { count: purchases.length, total: purchaseTotal.toFixed(2), taxTotal: purchaseTax.toFixed(2), discountTotal: purchaseDiscount.toFixed(2), quantity: purchaseQuantity.toString() },
      transfers: { count: transfers.length, outQuantity: transferOut.toString(), inQuantity: transferIn.toString() },
      stock: { lineCount: levels.length, quantity: stockQuantity.toString() },
      branches: [...branches.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([branchId, value]) => ({
        branchId, salesCount: value.salesCount, salesTotal: value.salesTotal.toFixed(2), purchaseCount: value.purchaseCount,
        purchaseTotal: value.purchaseTotal.toFixed(2), transferOutQuantity: value.transferOutQuantity.toString(),
        transferInQuantity: value.transferInQuantity.toString(), stockQuantity: value.stockQuantity.toString(),
      })),
    };
  });
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function operationsReportCsv(report: OperationsReport): string {
  const rows: Array<Array<string | number | null>> = [
    ["section", "metric", "value", "currency"],
    ["period", "from", report.period.from, null],
    ["period", "to", report.period.to, null],
    ["sales", "count", report.sales.count, null],
    ["sales", "total", report.sales.total, report.currency],
    ["sales", "quantity", report.sales.quantity, null],
    ["purchases", "count", report.purchases.count, null],
    ["purchases", "total", report.purchases.total, report.currency],
    ["purchases", "tax_total", report.purchases.taxTotal, report.currency],
    ["purchases", "discount_total", report.purchases.discountTotal, report.currency],
    ["purchases", "quantity", report.purchases.quantity, null],
    ["transfers", "count", report.transfers.count, null],
    ["transfers", "out_quantity", report.transfers.outQuantity, null],
    ["transfers", "in_quantity", report.transfers.inQuantity, null],
    ["stock", "line_count", report.stock.lineCount, null],
    ["stock", "quantity", report.stock.quantity, null],
  ];
  for (const branch of report.branches) {
    rows.push(["branch", `${branch.branchId}:sales_total`, branch.salesTotal, report.currency]);
    rows.push(["branch", `${branch.branchId}:purchase_total`, branch.purchaseTotal, report.currency]);
    rows.push(["branch", `${branch.branchId}:stock_quantity`, branch.stockQuantity, null]);
    rows.push(["branch", `${branch.branchId}:transfer_out_quantity`, branch.transferOutQuantity, null]);
    rows.push(["branch", `${branch.branchId}:transfer_in_quantity`, branch.transferInQuantity, null]);
  }
  return rows.map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\n") + "\n";
}

import Decimal from "decimal.js";
import { z } from "zod";
import { FinancialDecimal, money, assertMoneyPrecision } from "./cash";

export class PromotionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromotionError";
  }
}

const integerQuantityPattern = /^[1-9]\d*$/;

export const promotionRuleSchema = z
  .object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    branchId: z.string().uuid().nullable().optional(),
    categoryId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    n: z.string().regex(integerQuantityPattern, "INVALID_N_QUANTITY"),
    m: z.string().regex(integerQuantityPattern, "INVALID_M_QUANTITY"),
    active: z.boolean().default(true),
    validFrom: z.date().nullable().optional(),
    validTo: z.date().nullable().optional(),
  })
  .refine(
    (data) => new FinancialDecimal(data.n).gt(new FinancialDecimal(data.m)),
    {
      message: "N_MUST_BE_GREATER_THAN_M",
      path: ["n"],
    },
  )
  .refine(
    (data) => {
      if (data.validFrom && data.validTo) {
        return data.validTo >= data.validFrom;
      }
      return true;
    },
    {
      message: "VALID_TO_BEFORE_VALID_FROM",
      path: ["validTo"],
    },
  );

export type PromotionRule = z.infer<typeof promotionRuleSchema>;

export const promotionConfigSchema = z
  .object({
    branchId: z.string().uuid().nullable().optional(),
    categoryId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    n: z.string().regex(integerQuantityPattern, "INVALID_N_QUANTITY"),
    m: z.string().regex(integerQuantityPattern, "INVALID_M_QUANTITY"),
    active: z.boolean().default(true),
    validFrom: z.coerce.date().nullable().optional(),
    validTo: z.coerce.date().nullable().optional(),
  })
  .strict()
  .refine((data) => new FinancialDecimal(data.n).gt(new FinancialDecimal(data.m)), {
    message: "N_MUST_BE_GREATER_THAN_M",
    path: ["n"],
  })
  .refine((data) => !data.validFrom || !data.validTo || data.validTo >= data.validFrom, {
    message: "VALID_TO_BEFORE_VALID_FROM",
    path: ["validTo"],
  });

export type PromotionConfigInput = z.infer<typeof promotionConfigSchema>;

export interface PromotionCartLine {
  variantId: string;
  categoryId: string;
  quantity: string;
  unitPrice: string;
  currency?: string;
}

export interface PromotionContext {
  tenantId: string;
  branchId?: string | null;
  now: Date;
  currency?: string;
}

export interface EvaluatedPromotionLine {
  variantId: string;
  categoryId: string;
  quantity: string;
  regularUnitPrice: string;
  regularTotal: string;
  discountAmount: string;
  effectiveTotal: string;
  effectiveUnitPrice: string;
  discountedUnits: string;
  appliedPromotion: {
    id: string;
    name: string;
    n: string;
    m: string;
    categoryId: string;
  } | null;
}

export interface AppliedPromotionSummary {
  id: string;
  name: string;
  n: string;
  m: string;
  categoryId: string;
  totalDiscount: string;
  discountedUnits: string;
}

export const appliedPromotionSnapshotSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  n: z.string(),
  m: z.string(),
  categoryId: z.string().uuid(),
}).strict();

export type AppliedPromotionSnapshot = z.infer<typeof appliedPromotionSnapshotSchema>;

export interface PromotionSnapshot {
  type: "PROMOTION";
  regularUnitPrice: string;
  regularTotal: string;
  discountAmount: string;
  effectiveTotal: string;
  effectiveUnitPrice: string;
  discountedUnits: string;
  promotion: AppliedPromotionSnapshot;
}

export interface PromotionEvaluationResult {
  lines: EvaluatedPromotionLine[];
  totalRegular: string;
  totalDiscount: string;
  totalEffective: string;
  appliedPromotions: AppliedPromotionSummary[];
}

interface SortedLineSegment {
  lineIndex: number;
  variantId: string;
  unitPrice: Decimal;
  quantity: Decimal;
}

interface CandidateOutcome {
  promotion: PromotionRule;
  totalDiscount: Decimal;
  discountedUnitsByLine: Map<number, Decimal>;
  discountAmountByLine: Map<number, Decimal>;
  totalDiscountedUnits: Decimal;
}

function discountedUnitsBefore(position: Decimal, n: Decimal, m: Decimal): Decimal {
  const completeGroups = position.dividedToIntegerBy(n);
  const remainder = position.mod(n);
  return completeGroups.times(n.minus(m)).plus(FinancialDecimal.max(0, remainder.minus(m)));
}

function compareCandidates(a: CandidateOutcome, b: CandidateOutcome): number {
  if (a.totalDiscount.gt(b.totalDiscount)) return -1;
  if (a.totalDiscount.lt(b.totalDiscount)) return 1;

  const aHasBranch = Boolean(a.promotion.branchId);
  const bHasBranch = Boolean(b.promotion.branchId);
  if (aHasBranch !== bHasBranch) {
    return aHasBranch ? -1 : 1;
  }

  return a.promotion.id.localeCompare(b.promotion.id);
}

/**
 * Evaluates candidate N×M outcome using segment math over sorted lines.
 * For each complete group of size N formed from the highest to lowest priced items:
 * - The first M units are paid at regular price.
 * - The remaining (N - M) cheapest units inside the group are discounted 100%.
 */
function evaluateCandidateOutcome(
  segments: readonly SortedLineSegment[],
  promo: PromotionRule,
): CandidateOutcome | null {
  const nDec = new FinancialDecimal(promo.n);
  const mDec = new FinancialDecimal(promo.m);

  const totalUnits = segments.reduce((sum, s) => sum.plus(s.quantity), new FinancialDecimal(0));
  const groupsDec = totalUnits.dividedToIntegerBy(nDec);
  if (groupsDec.lte(0)) {
    return null;
  }

  const eligibleUnitsLimit = groupsDec.times(nDec);
  const discountedUnitsByLine = new Map<number, Decimal>();
  const discountAmountByLine = new Map<number, Decimal>();
  let totalDiscount = new FinancialDecimal(0);
  let totalDiscountedUnits = new FinancialDecimal(0);

  let currentUnitOffset = new FinancialDecimal(0);

  for (const seg of segments) {
    if (currentUnitOffset.gte(eligibleUnitsLimit)) {
      break;
    }

    const segStart = currentUnitOffset;
    const segAvailable = FinancialDecimal.min(seg.quantity, eligibleUnitsLimit.minus(segStart));
    const segEnd = segStart.plus(segAvailable);

    // Free positions repeat every N units after the first M paid positions.
    // The cumulative formula keeps evaluation O(cart lines), independent of quantity size.
    const segDiscountedUnits = discountedUnitsBefore(segEnd, nDec, mDec)
      .minus(discountedUnitsBefore(segStart, nDec, mDec));

    if (segDiscountedUnits.gt(0)) {
      const priorCount = discountedUnitsByLine.get(seg.lineIndex) ?? new FinancialDecimal(0);
      discountedUnitsByLine.set(seg.lineIndex, priorCount.plus(segDiscountedUnits));

      const segDiscountAmount = segDiscountedUnits.times(seg.unitPrice);
      const priorAmount = discountAmountByLine.get(seg.lineIndex) ?? new FinancialDecimal(0);
      discountAmountByLine.set(seg.lineIndex, priorAmount.plus(segDiscountAmount));

      totalDiscount = totalDiscount.plus(segDiscountAmount);
      totalDiscountedUnits = totalDiscountedUnits.plus(segDiscountedUnits);
    }

    currentUnitOffset = segEnd;
  }

  if (totalDiscount.lte(0)) {
    return null;
  }

  return {
    promotion: promo,
    totalDiscount,
    discountedUnitsByLine,
    discountAmountByLine,
    totalDiscountedUnits,
  };
}

export function evaluatePromotions(
  cartLines: PromotionCartLine[],
  promotions: PromotionRule[],
  context: PromotionContext,
): PromotionEvaluationResult {
  const defaultCurrency = context.currency ?? "ARS";
  const seenVariants = new Set<string>();

  for (const line of cartLines) {
    if (seenVariants.has(line.variantId)) {
      throw new PromotionError("DUPLICATE_CART_VARIANT");
    }
    seenVariants.add(line.variantId);

    const qty = new FinancialDecimal(line.quantity);
    if (qty.lte(0)) {
      throw new PromotionError("INVALID_QUANTITY");
    }
    if (qty.decimalPlaces() > 0) {
      throw new PromotionError("FRACTIONAL_QUANTITY_NOT_ALLOWED");
    }

    const price = new FinancialDecimal(line.unitPrice);
    if (price.isNegative()) {
      throw new PromotionError("INVALID_PRICE");
    }

    const currency = line.currency ?? defaultCurrency;
    assertMoneyPrecision(line.unitPrice, currency);
  }

  const linesByCategory = new Map<string, Array<{ line: PromotionCartLine; index: number }>>();
  cartLines.forEach((line, index) => {
    const list = linesByCategory.get(line.categoryId) ?? [];
    list.push({ line, index });
    linesByCategory.set(line.categoryId, list);
  });

  const lineDiscounts = new Map<number, Decimal>();
  const lineDiscountedUnits = new Map<number, Decimal>();
  const lineAppliedPromo = new Map<number, PromotionRule>();
  const appliedPromotionsList: AppliedPromotionSummary[] = [];

  for (const [categoryId, categoryLines] of linesByCategory.entries()) {
    const eligiblePromotions = promotions.filter((p) => {
      if (p.tenantId !== context.tenantId) return false;
      if (p.categoryId !== categoryId) return false;
      if (!p.active) return false;
      if (p.branchId && p.branchId !== context.branchId) return false;
      if (p.validFrom && context.now < p.validFrom) return false;
      if (p.validTo && context.now > p.validTo) return false;
      return true;
    });

    if (eligiblePromotions.length === 0) {
      continue;
    }

    // Sort line segments by price descending to maximize benefit per group
    const segments: SortedLineSegment[] = categoryLines.map(({ line, index }) => ({
      lineIndex: index,
      variantId: line.variantId,
      unitPrice: new FinancialDecimal(line.unitPrice),
      quantity: new FinancialDecimal(line.quantity),
    }));

    segments.sort((a, b) => {
      if (a.unitPrice.gt(b.unitPrice)) return -1;
      if (a.unitPrice.lt(b.unitPrice)) return 1;
      return a.variantId.localeCompare(b.variantId);
    });

    const candidateOutcomes: CandidateOutcome[] = [];

    for (const promo of eligiblePromotions) {
      const outcome = evaluateCandidateOutcome(segments, promo);
      if (outcome) {
        candidateOutcomes.push(outcome);
      }
    }

    if (candidateOutcomes.length === 0) {
      continue;
    }

    candidateOutcomes.sort(compareCandidates);
    const winningOutcome = candidateOutcomes[0];

    for (const [lineIdx, count] of winningOutcome.discountedUnitsByLine.entries()) {
      lineDiscountedUnits.set(lineIdx, count);
    }
    for (const [lineIdx, amount] of winningOutcome.discountAmountByLine.entries()) {
      lineDiscounts.set(lineIdx, amount);
      lineAppliedPromo.set(lineIdx, winningOutcome.promotion);
    }

    appliedPromotionsList.push({
      id: winningOutcome.promotion.id,
      name: winningOutcome.promotion.name,
      n: winningOutcome.promotion.n,
      m: winningOutcome.promotion.m,
      categoryId: winningOutcome.promotion.categoryId,
      totalDiscount: money(winningOutcome.totalDiscount, defaultCurrency),
      discountedUnits: winningOutcome.totalDiscountedUnits.toString(),
    });
  }

  const evaluatedLines: EvaluatedPromotionLine[] = cartLines.map((line, index) => {
    const currency = line.currency ?? defaultCurrency;
    const regularTotalDec = new FinancialDecimal(line.quantity).times(line.unitPrice);
    const regularTotalStr = money(regularTotalDec, currency);
    const regularUnitPriceStr = money(line.unitPrice, currency);

    const discountDec = lineDiscounts.get(index) ?? new FinancialDecimal(0);
    const discountStr = money(discountDec, currency);

    const effectiveTotalDec = new FinancialDecimal(regularTotalStr).minus(discountStr);
    const effectiveTotalStr = money(effectiveTotalDec, currency);

    const effectiveUnitPriceDec = effectiveTotalDec
      .div(line.quantity)
      .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const effectiveUnitPriceStr = effectiveUnitPriceDec.toFixed(4);

    const discountedUnitsDec = lineDiscountedUnits.get(index) ?? new FinancialDecimal(0);
    const promo = lineAppliedPromo.get(index);

    return {
      variantId: line.variantId,
      categoryId: line.categoryId,
      quantity: line.quantity,
      regularUnitPrice: regularUnitPriceStr,
      regularTotal: regularTotalStr,
      discountAmount: discountStr,
      effectiveTotal: effectiveTotalStr,
      effectiveUnitPrice: effectiveUnitPriceStr,
      discountedUnits: discountedUnitsDec.toString(),
      appliedPromotion:
        promo && discountDec.gt(0)
          ? {
              id: promo.id,
              name: promo.name,
              n: promo.n,
              m: promo.m,
              categoryId: promo.categoryId,
            }
          : null,
    };
  });

  const totalRegularDec = evaluatedLines.reduce(
    (sum, l) => sum.plus(l.regularTotal),
    new FinancialDecimal(0),
  );
  const totalDiscountDec = evaluatedLines.reduce(
    (sum, l) => sum.plus(l.discountAmount),
    new FinancialDecimal(0),
  );
  const totalEffectiveDec = totalRegularDec.minus(totalDiscountDec);

  return {
    lines: evaluatedLines,
    totalRegular: money(totalRegularDec, defaultCurrency),
    totalDiscount: money(totalDiscountDec, defaultCurrency),
    totalEffective: money(totalEffectiveDec, defaultCurrency),
    appliedPromotions: appliedPromotionsList,
  };
}

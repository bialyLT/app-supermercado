import { describe, expect, it } from "vitest";
import type {
  PromotionCartLine,
  PromotionContext,
  PromotionRule,
} from "../src/domain/promotions";
import {
  evaluatePromotions,
  PromotionError,
  promotionRuleSchema,
} from "../src/domain/promotions";
import { FinancialDecimal, money } from "../src/domain/cash";

const tenantA = "a0000000-0000-4000-8000-000000000001";
const tenantB = "a0000000-0000-4000-8000-000000000002";
const branchA1 = "b0000000-0000-4000-8000-000000000001";
const categoryBeverages = "c0000000-0000-4000-8000-000000000001";
const categorySnacks = "c0000000-0000-4000-8000-000000000002";
const categoryDairy = "c0000000-0000-4000-8000-000000000003";

const baseDate = new Date("2026-10-30T12:00:00.000Z");

function makeRule(overrides: Partial<PromotionRule> = {}): PromotionRule {
  return {
    id: overrides.id ?? "d0000000-0000-4000-8000-000000000001",
    tenantId: overrides.tenantId ?? tenantA,
    branchId: overrides.branchId ?? null,
    categoryId: overrides.categoryId ?? categoryBeverages,
    name: overrides.name ?? "2x1 Bebidas",
    n: overrides.n ?? "2",
    m: overrides.m ?? "1",
    active: overrides.active ?? true,
    validFrom: overrides.validFrom ?? null,
    validTo: overrides.validTo ?? null,
  };
}

describe("promotionRuleSchema validation (S1, S5)", () => {
  it("accepts valid N>M integer string configurations", () => {
    const rule2x1 = makeRule({ n: "2", m: "1" });
    const rule3x2 = makeRule({ n: "3", m: "2" });
    expect(promotionRuleSchema.parse(rule2x1)).toMatchObject({ n: "2", m: "1" });
    expect(promotionRuleSchema.parse(rule3x2)).toMatchObject({ n: "3", m: "2" });
  });

  it("rejects n <= m and m < 1", () => {
    expect(() => promotionRuleSchema.parse(makeRule({ n: "2", m: "2" }))).toThrow("N_MUST_BE_GREATER_THAN_M");
    expect(() => promotionRuleSchema.parse(makeRule({ n: "1", m: "2" }))).toThrow("N_MUST_BE_GREATER_THAN_M");
    expect(() => promotionRuleSchema.parse(makeRule({ n: "2", m: "0" }))).toThrow();
  });

  it("rejects invalid validity windows where validTo is before validFrom", () => {
    expect(() =>
      promotionRuleSchema.parse(
        makeRule({
          validFrom: new Date("2026-11-01T00:00:00.000Z"),
          validTo: new Date("2026-10-31T00:00:00.000Z"),
        }),
      ),
    ).toThrow("VALID_TO_BEFORE_VALID_FROM");
  });

  it("rejects non-integer strings, blank names, or blank category IDs", () => {
    expect(() => promotionRuleSchema.parse(makeRule({ n: "2.5" }))).toThrow();
    expect(() => promotionRuleSchema.parse(makeRule({ name: "   " }))).toThrow();
    expect(() => promotionRuleSchema.parse(makeRule({ categoryId: "not-a-uuid" }))).toThrow();
  });
});

describe("discrete units validation (S3)", () => {
  const context: PromotionContext = {
    tenantId: tenantA,
    branchId: branchA1,
    now: baseDate,
    currency: "ARS",
  };

  it("rejects fractional quantities", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "1.500",
      },
    ];
    expect(() => evaluatePromotions(lines, [makeRule()], context)).toThrow(PromotionError);
    expect(() => evaluatePromotions(lines, [makeRule()], context)).toThrow("FRACTIONAL_QUANTITY_NOT_ALLOWED");
  });

  it("rejects non-positive quantities and negative prices", () => {
    const zeroQty: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "0",
      },
    ];
    expect(() => evaluatePromotions(zeroQty, [makeRule()], context)).toThrow("INVALID_QUANTITY");

    const negPrice: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "-10.00",
        quantity: "2",
      },
    ];
    expect(() => evaluatePromotions(negPrice, [makeRule()], context)).toThrow("INVALID_PRICE");
  });

  it("rejects duplicate variant lines in the cart", () => {
    const duplicateVariants: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "1",
      },
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "2",
      },
    ];
    expect(() => evaluatePromotions(duplicateVariants, [makeRule()], context)).toThrow("DUPLICATE_CART_VARIANT");
  });
});

describe("automatic NxM evaluation (S1, S3, S4)", () => {
  const context: PromotionContext = {
    tenantId: tenantA,
    branchId: branchA1,
    now: baseDate,
    currency: "ARS",
  };

  it("applies 2x1 to exact group of 2: 1 free, 1 paid", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "150.00",
        quantity: "2",
      },
    ];
    const result = evaluatePromotions(lines, [makeRule({ n: "2", m: "1" })], context);
    expect(result.lines[0].regularTotal).toBe("300.00");
    expect(result.lines[0].discountAmount).toBe("150.00");
    expect(result.lines[0].effectiveTotal).toBe("150.00");
    expect(result.lines[0].discountedUnits).toBe("1");
    expect(result.lines[0].appliedPromotion?.name).toBe("2x1 Bebidas");
    expect(result.totalEffective).toBe("150.00");
  });

  it("applies 2x1 with remainder: complete group discounted, remainder at regular price", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "3",
      },
    ];
    const result = evaluatePromotions(lines, [makeRule({ n: "2", m: "1" })], context);
    expect(result.lines[0].regularTotal).toBe("300.00");
    expect(result.lines[0].discountAmount).toBe("100.00");
    expect(result.lines[0].effectiveTotal).toBe("200.00");
    expect(result.lines[0].discountedUnits).toBe("1");
    expect(result.totalEffective).toBe("200.00");
  });

  it("applies 2x1 with multiple groups (4 units = 2 groups of 2)", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "4",
      },
    ];
    const result = evaluatePromotions(lines, [makeRule({ n: "2", m: "1" })], context);
    expect(result.lines[0].discountAmount).toBe("200.00");
    expect(result.lines[0].effectiveTotal).toBe("200.00");
    expect(result.lines[0].discountedUnits).toBe("2");
  });

  it("applies 3x2 (carry 3, pay 2, 1 free)", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "50.00",
        quantity: "3",
      },
    ];
    const result = evaluatePromotions(lines, [makeRule({ n: "3", m: "2", name: "3x2 Bebidas" })], context);
    expect(result.lines[0].regularTotal).toBe("150.00");
    expect(result.lines[0].discountAmount).toBe("50.00");
    expect(result.lines[0].effectiveTotal).toBe("100.00");
    expect(result.lines[0].discountedUnits).toBe("1");
  });
});

describe("different prices: cheapest units discounted within category (S4)", () => {
  const context: PromotionContext = {
    tenantId: tenantA,
    branchId: branchA1,
    now: baseDate,
    currency: "ARS",
  };

  it("discounts the cheapest unit across distinct products in 2x1", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "1",
      },
      {
        variantId: "e0000000-0000-4000-8000-000000000002",
        categoryId: categoryBeverages,
        unitPrice: "200.00",
        quantity: "1",
      },
    ];
    const result = evaluatePromotions(lines, [makeRule({ n: "2", m: "1" })], context);
    const lineA = result.lines.find((l) => l.variantId === lines[0].variantId)!;
    const lineB = result.lines.find((l) => l.variantId === lines[1].variantId)!;

    expect(lineA.discountAmount).toBe("100.00");
    expect(lineA.effectiveTotal).toBe("0.00");
    expect(lineA.discountedUnits).toBe("1");
    expect(lineA.appliedPromotion).toBeTruthy();

    expect(lineB.discountAmount).toBe("0.00");
    expect(lineB.effectiveTotal).toBe("200.00");
    expect(lineB.discountedUnits).toBe("0");

    expect(result.totalRegular).toBe("300.00");
    expect(result.totalDiscount).toBe("100.00");
    expect(result.totalEffective).toBe("200.00");
  });

  it("regression (a): 2x1 with 100, 100 plus 10 remainder discounts 100 and totals 110", () => {
    // 2 units at 100.00 and 1 unit at 10.00.
    // Sorted descending: [100, 100, 10].
    // Group 1 (size 2): [100, 100] -> cheapest in group is 100.00 -> discount 100.00.
    // Remainder: [10] -> regular 10.00.
    // Total discount = 100.00, total effective = 110.00.
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "2",
      },
      {
        variantId: "e0000000-0000-4000-8000-000000000002",
        categoryId: categoryBeverages,
        unitPrice: "10.00",
        quantity: "1",
      },
    ];
    const result = evaluatePromotions(lines, [makeRule({ n: "2", m: "1" })], context);

    expect(result.totalRegular).toBe("210.00");
    expect(result.totalDiscount).toBe("100.00");
    expect(result.totalEffective).toBe("110.00");
  });

  it("regression (b): 2x1 with 100, 100, 20, 20 discounts 120 and totals 120", () => {
    // 2 units at 100.00 and 2 units at 20.00.
    // Sorted descending: [100, 100, 20, 20].
    // Group 1: [100, 100] -> discount 100.00.
    // Group 2: [20, 20] -> discount 20.00.
    // Total discount = 120.00, total effective = 120.00.
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "2",
      },
      {
        variantId: "e0000000-0000-4000-8000-000000000002",
        categoryId: categoryBeverages,
        unitPrice: "20.00",
        quantity: "2",
      },
    ];
    const result = evaluatePromotions(lines, [makeRule({ n: "2", m: "1" })], context);

    expect(result.totalRegular).toBe("240.00");
    expect(result.totalDiscount).toBe("120.00");
    expect(result.totalEffective).toBe("120.00");
  });

  it("evaluates very large discrete quantities without expanding units or groups", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "1.00",
        quantity: "1000000000000",
      },
    ];

    const result = evaluatePromotions(lines, [makeRule({ n: "2", m: "1" })], context);

    expect(result.totalDiscount).toBe("500000000000.00");
    expect(result.totalEffective).toBe("500000000000.00");
    expect(result.lines[0].discountedUnits).toBe("500000000000");
  });

  it("handles multi-unit multi-group mixed lines: A ($30, qty 1), B ($70, qty 3) with 2x1", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "30.00",
        quantity: "1",
      },
      {
        variantId: "e0000000-0000-4000-8000-000000000002",
        categoryId: categoryBeverages,
        unitPrice: "70.00",
        quantity: "3",
      },
    ];
    const result = evaluatePromotions(lines, [makeRule({ n: "2", m: "1" })], context);
    const lineA = result.lines.find((l) => l.variantId === lines[0].variantId)!;
    const lineB = result.lines.find((l) => l.variantId === lines[1].variantId)!;

    expect(lineA.discountAmount).toBe("30.00");
    expect(lineA.effectiveTotal).toBe("0.00");
    expect(lineA.discountedUnits).toBe("1");

    expect(lineB.discountAmount).toBe("70.00");
    expect(lineB.effectiveTotal).toBe("140.00");
    expect(lineB.discountedUnits).toBe("1");

    expect(result.totalRegular).toBe("240.00");
    expect(result.totalDiscount).toBe("100.00");
    expect(result.totalEffective).toBe("140.00");
  });
});

describe("deterministic greatest-benefit selection without stacking (S4)", () => {
  const context: PromotionContext = {
    tenantId: tenantA,
    branchId: branchA1,
    now: baseDate,
    currency: "ARS",
  };

  it("selects the rule that gives the largest discount without accumulating", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "3",
      },
    ];
    const rule2x1 = makeRule({ id: "d0000000-0000-4000-8000-000000000001", n: "2", m: "1", name: "2x1 Bebidas" });
    const rule3x1 = makeRule({ id: "d0000000-0000-4000-8000-000000000002", n: "3", m: "1", name: "3x1 Bebidas" });

    const result = evaluatePromotions(lines, [rule2x1, rule3x1], context);
    expect(result.totalDiscount).toBe("200.00");
    expect(result.totalEffective).toBe("100.00");
    expect(result.lines[0].appliedPromotion?.name).toBe("3x1 Bebidas");
  });

  it("breaks ties deterministically in favor of branch-specific rule over tenant-wide rule", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "2",
      },
    ];
    const ruleGlobal = makeRule({ id: "d0000000-0000-4000-8000-000000000001", branchId: null, name: "2x1 Global" });
    const ruleBranch = makeRule({ id: "d0000000-0000-4000-8000-000000000002", branchId: branchA1, name: "2x1 Sucursal" });

    const result = evaluatePromotions(lines, [ruleGlobal, ruleBranch], context);
    expect(result.lines[0].appliedPromotion?.name).toBe("2x1 Sucursal");
  });

  it("breaks equal-benefit ties deterministically by stable ID when scopes match", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "3",
      },
    ];
    // Both give 100.00 discount on 3 items:
    // Rule A: 2x1 (n=2, m=1), Rule B: 3x2 (n=3, m=2).
    const ruleA = makeRule({ id: "d0000000-0000-4000-8000-000000000001", n: "2", m: "1", name: "Rule A" });
    const ruleB = makeRule({ id: "d0000000-0000-4000-8000-000000000002", n: "3", m: "2", name: "Rule B" });

    const result = evaluatePromotions(lines, [ruleA, ruleB], context);
    expect(result.lines[0].appliedPromotion?.id).toBe("d0000000-0000-4000-8000-000000000001");
  });
});

describe("scope, tenant isolation, branch scoping, and validity (S5)", () => {
  it("ignores promotions from a different tenant", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "2",
      },
    ];
    const otherTenantRule = makeRule({ tenantId: tenantB });
    const context: PromotionContext = { tenantId: tenantA, branchId: branchA1, now: baseDate, currency: "ARS" };

    const result = evaluatePromotions(lines, [otherTenantRule], context);
    expect(result.totalDiscount).toBe("0.00");
    expect(result.totalEffective).toBe("200.00");
    expect(result.lines[0].appliedPromotion).toBeNull();
  });

  it("applies tenant-wide promotion when branch-specific rule gives zero benefit", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "2",
      },
    ];
    const branchRule3x1 = makeRule({ id: "d0000000-0000-4000-8000-000000000001", branchId: branchA1, n: "3", m: "1", name: "3x1 Sucursal" });
    const globalRule2x1 = makeRule({ id: "d0000000-0000-4000-8000-000000000002", branchId: null, n: "2", m: "1", name: "2x1 Global" });

    const context: PromotionContext = { tenantId: tenantA, branchId: branchA1, now: baseDate, currency: "ARS" };
    const result = evaluatePromotions(lines, [branchRule3x1, globalRule2x1], context);
    expect(result.totalDiscount).toBe("100.00");
    expect(result.lines[0].appliedPromotion?.name).toBe("2x1 Global");
  });

  it("ignores inactive and out-of-validity promotions", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "2",
      },
    ];
    const inactiveRule = makeRule({ active: false });
    const futureRule = makeRule({ validFrom: new Date("2026-11-01T00:00:00.000Z") });
    const pastRule = makeRule({ validTo: new Date("2026-10-29T00:00:00.000Z") });
    const context: PromotionContext = { tenantId: tenantA, branchId: branchA1, now: baseDate, currency: "ARS" };

    expect(evaluatePromotions(lines, [inactiveRule], context).totalDiscount).toBe("0.00");
    expect(evaluatePromotions(lines, [futureRule], context).totalDiscount).toBe("0.00");
    expect(evaluatePromotions(lines, [pastRule], context).totalDiscount).toBe("0.00");
  });
});

describe("multi-category cart evaluation (S3, S4)", () => {
  const context: PromotionContext = {
    tenantId: tenantA,
    branchId: branchA1,
    now: baseDate,
    currency: "ARS",
  };

  it("evaluates promotions independently by category without cross-category combo", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "100.00",
        quantity: "2",
      },
      {
        variantId: "e0000000-0000-4000-8000-000000000002",
        categoryId: categorySnacks,
        unitPrice: "50.00",
        quantity: "3",
      },
      {
        variantId: "e0000000-0000-4000-8000-000000000003",
        categoryId: categoryDairy,
        unitPrice: "80.00",
        quantity: "1",
      },
    ];

    const bevPromo = makeRule({ id: "d0000000-0000-4000-8000-000000000001", categoryId: categoryBeverages, n: "2", m: "1", name: "2x1 Bebidas" });
    const snackPromo = makeRule({ id: "d0000000-0000-4000-8000-000000000002", categoryId: categorySnacks, n: "3", m: "2", name: "3x2 Snacks" });

    const result = evaluatePromotions(lines, [bevPromo, snackPromo], context);

    const bevLine = result.lines.find((l) => l.variantId === lines[0].variantId)!;
    expect(bevLine.discountAmount).toBe("100.00");
    expect(bevLine.effectiveTotal).toBe("100.00");

    const snackLine = result.lines.find((l) => l.variantId === lines[1].variantId)!;
    expect(snackLine.discountAmount).toBe("50.00");
    expect(snackLine.effectiveTotal).toBe("100.00");

    const dairyLine = result.lines.find((l) => l.variantId === lines[2].variantId)!;
    expect(dairyLine.discountAmount).toBe("0.00");
    expect(dairyLine.effectiveTotal).toBe("80.00");

    expect(result.totalRegular).toBe("430.00");
    expect(result.totalDiscount).toBe("150.00");
    expect(result.totalEffective).toBe("280.00");
  });
});

describe("financial and line-level snapshot invariants (S2, DOMAIN_RULES §2)", () => {
  const context: PromotionContext = {
    tenantId: tenantA,
    branchId: branchA1,
    now: baseDate,
    currency: "ARS",
  };

  it("satisfies effectiveTotal + discountAmount === regularTotal for each line and cart totals", () => {
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "75.50",
        quantity: "3",
      },
      {
        variantId: "e0000000-0000-4000-8000-000000000002",
        categoryId: categoryBeverages,
        unitPrice: "120.25",
        quantity: "2",
      },
    ];
    const result = evaluatePromotions(lines, [makeRule({ n: "2", m: "1" })], context);
    for (const line of result.lines) {
      const sum = new FinancialDecimal(line.effectiveTotal).plus(line.discountAmount);
      expect(sum.toString()).toBe(new FinancialDecimal(line.regularTotal).toString());
    }
    const cartSum = new FinancialDecimal(result.totalEffective).plus(result.totalDiscount);
    expect(cartSum.toString()).toBe(new FinancialDecimal(result.totalRegular).toString());
  });

  it("RED regression: retains sufficient effectiveUnitPrice precision so 3x2 at 10.00 recomputes to exact line total 20.00", () => {
    // 3 units at 10.00 with 3x2 (pay 2 -> effective total 20.00).
    // If effectiveUnitPrice is prematurely truncated/rounded to 2 decimals ("6.67"),
    // 3 * 6.67 = 20.01 != 20.00.
    // Preserving 4 decimals ("6.6667") recomputes with line HALF_UP: money(3 * 6.6667) = "20.00".
    const lines: PromotionCartLine[] = [
      {
        variantId: "e0000000-0000-4000-8000-000000000001",
        categoryId: categoryBeverages,
        unitPrice: "10.00",
        quantity: "3",
      },
    ];
    const result = evaluatePromotions(lines, [makeRule({ n: "3", m: "2", name: "3x2 Bebidas" })], context);
    const line = result.lines[0];

    expect(line.effectiveTotal).toBe("20.00");
    expect(line.effectiveUnitPrice).toBe("6.6667");
    // Verify that recomputing quantity * effectiveUnitPrice with line HALF_UP matches effectiveTotal exactly
    const lineRawTotal = new FinancialDecimal(line.quantity).times(line.effectiveUnitPrice);
    const recomputedTotal = money(lineRawTotal, "ARS");
    expect(recomputedTotal).toBe(line.effectiveTotal);
  });
});

import { describe, expect, it } from "vitest";
import { FinancialDecimal, money } from "../src/domain/cash";
import { buildFiscalContext, buildFiscalSnapshot, FiscalCondition, FiscalError, fiscalConditionSchema, fiscalCountrySchema, fiscalProfileSchema, FiscalSnapshot, fiscalSnapshotSchema, httpStatus } from "../src/domain/fiscal";

const storeId = "123e4567-e89b-42d3-a456-426614174000";

describe("argentine fiscal domain contracts", () => {
  it("accepts only the two approved argentine regimes, with no pending regime or default", () => {
    expect(fiscalConditionSchema.safeParse("MONOTRIBUTO").success).toBe(true);
    expect(fiscalConditionSchema.safeParse("RESPONSABLE_INSCRIPTO").success).toBe(true);
    expect(fiscalConditionSchema.safeParse("PENDING").success).toBe(false);
    expect(fiscalConditionSchema.safeParse("MONOTRIBUTOR").success).toBe(false);
    expect(fiscalConditionSchema.safeParse(undefined).success).toBe(false);
  });

  it("accepts only the argentine country context", () => {
    expect(fiscalCountrySchema.safeParse("AR").success).toBe(true);
    expect(fiscalCountrySchema.safeParse("UY").success).toBe(false);
  });

  it("requires an explicit internal ticket and rejects unknown keys", () => {
    const valid = { storeId, condition: "MONOTRIBUTO" as const, internalTicket: true };
    expect(fiscalProfileSchema.safeParse(valid).success).toBe(true);
    expect(fiscalProfileSchema.safeParse({ storeId, condition: "MONOTRIBUTO", internalTicket: undefined }).success).toBe(false);
    expect(fiscalProfileSchema.safeParse({ storeId, condition: "MONOTRIBUTO", internalTicket: true, country: "AR" }).success).toBe(false);
    expect(fiscalProfileSchema.safeParse({ storeId, condition: "MONOTRIBUTO", internalTicket: false }).success).toBe(false);
  });

  it("builds typed version 1 snapshots from the approved regimes", () => {
    const snapshot = buildFiscalSnapshot({ storeId, storeName: "Kiosco Centro", country: "AR", condition: "RESPONSABLE_INSCRIPTO", internalTicket: true });
    expect(snapshot).toEqual({ version: 1, storeId, storeName: "Kiosco Centro", country: "AR", condition: "RESPONSABLE_INSCRIPTO", internalTicket: true });
    expect(fiscalSnapshotSchema.safeParse({ ...snapshot, version: 2 }).success).toBe(false);
    const invalidConditionSnapshot = { ...snapshot, condition: "PENDING" } as unknown as FiscalSnapshot;
    expect(fiscalSnapshotSchema.safeParse(invalidConditionSnapshot).success).toBe(false);
  });

  it("rounds each line HALF_UP and totals the sum of rounded lines (S1)", () => {
    expect(money(new FinancialDecimal("1.005"), "XTS")).toBe("1.01");
    const lines = ["1.005", "2.005"].map((line) => money(new FinancialDecimal(line), "XTS"));
    expect(lines).toEqual(["1.01", "2.01"]);
    expect(new FinancialDecimal(lines[0]).plus(new FinancialDecimal(lines[1])).toString()).toBe("3.02");
  });

  it("rejects fiscal contexts with unsupported country, condition, or internal ticket", () => {
    expect(() => buildFiscalContext({ storeId, storeName: "Kiosco Centro", country: "UY", condition: "MONOTRIBUTO", internalTicket: true })).toThrow("FISCAL_COUNTRY_UNSUPPORTED");
    const invalidContext = { storeId, storeName: "Kiosco Centro", country: "AR", condition: "PENDING" as FiscalCondition, internalTicket: true };
    expect(() => buildFiscalContext(invalidContext)).toThrow("FISCAL_CONDITION_UNSUPPORTED");
    expect(() => buildFiscalContext({ storeId, storeName: "Kiosco Centro", country: "AR", condition: "MONOTRIBUTO", internalTicket: false })).toThrow("FISCAL_CONTEXT_REQUIRED");
    expect(() => buildFiscalContext({ storeId: "", storeName: "Kiosco Centro", country: "AR", condition: "MONOTRIBUTO", internalTicket: true })).toThrow("FISCAL_CONTEXT_REQUIRED");
  });

  it("rejects snapshots that do not satisfy the strict version 1 contract", () => {
    expect(() => buildFiscalSnapshot({ storeId, storeName: "Kiosco Centro", country: "AR", condition: "MONOTRIBUTO", internalTicket: false })).toThrow("FISCAL_SNAPSHOT_INVALID");
  });

  it("maps fiscal error codes to bounded status codes", () => {
    expect(httpStatus(new FiscalError("FISCAL_COUNTRY_UNSUPPORTED"))).toBe(400);
    expect(httpStatus(new FiscalError("FISCAL_CONDITION_UNSUPPORTED"))).toBe(400);
    expect(httpStatus(new FiscalError("FISCAL_SNAPSHOT_INVALID"))).toBe(400);
    expect(httpStatus(new FiscalError("FISCAL_CONTEXT_REQUIRED"))).toBe(400);
    expect(httpStatus(new FiscalError("FISCAL_UNKNOWN"))).toBe(500);
  });
});

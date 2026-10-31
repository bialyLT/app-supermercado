import { describe, expect, it } from "vitest";
import {
  calculateTransferQuantity,
  createEmptyTransferLine,
  validateTransferForm,
  type TransferFormState,
} from "../components/transfers/types";

const context = {
  tenantId: "tenant-1",
  branches: [
    { id: "11111111-1111-4111-8111-111111111111", code: "CEN", name: "Centro", locations: [{ id: "22222222-2222-4222-8222-222222222222", code: "DEP", name: "Depósito", type: "STORE", branchId: "11111111-1111-4111-8111-111111111111", active: true }] },
    { id: "33333333-3333-4333-8333-333333333333", code: "NOR", name: "Norte", locations: [{ id: "44444444-4444-4444-8444-444444444444", code: "SAL", name: "Salón", type: "STORE", branchId: "33333333-3333-4333-8333-333333333333", active: true }] },
  ],
  locations: [],
};

const valid: TransferFormState = {
  originBranchId: context.branches[0].id,
  destinationBranchId: context.branches[1].id,
  originLocationId: context.branches[0].locations[0].id,
  destinationLocationId: context.branches[1].locations[0].id,
  reason: "Reposición",
  idempotencyKey: "transfer-1",
  lines: [{ id: "line-1", variantId: "55555555-5555-4555-8555-555555555555", variantName: "Producto", lotId: "", quantity: "2" }],
};

describe("transfers UI helpers", () => {
  it("accepts comma decimal quantities", () => {
    const commaQuantity = { ...valid, lines: [{ ...valid.lines[0], quantity: "1,5" }] };
    expect(validateTransferForm(commaQuantity, context).lineErrors?.[0]?.quantity).toBeUndefined();
  });

  it("validates server-derived branches and locations", () => {
    expect(validateTransferForm(valid, context)).toEqual({});
    expect(validateTransferForm({ ...valid, destinationBranchId: valid.originBranchId }, context).destinationBranchId).toBeTruthy();
    expect(validateTransferForm({ ...valid, originLocationId: context.branches[1].locations[0].id }, context).originLocationId).toBeTruthy();
    expect(validateTransferForm({ ...valid, lines: [{ ...valid.lines[0], variantId: "" }] }, context).lineErrors?.[0]?.variantId).toBeTruthy();
  });

  it("rejects duplicate lines and invalid quantities", () => {
    expect(validateTransferForm({ ...valid, lines: [valid.lines[0], { ...valid.lines[0], id: "line-2" }] }, context).lines).toBeTruthy();
    expect(validateTransferForm({ ...valid, lines: [{ ...valid.lines[0], quantity: "0" }] }, context).lineErrors?.[0]?.quantity).toBeTruthy();
  });

  it("keeps Decimal quantities exact", () => {
    expect(calculateTransferQuantity("1.25", "2")).toBe("2.50");
    expect(createEmptyTransferLine().quantity).toBe("1");
  });
});

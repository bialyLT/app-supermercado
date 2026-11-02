import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createReceiptFormState,
  inventoryErrorMessage,
  parseInventoryResponse,
  receiptListResponseSchema,
  safeInventoryDate,
  resetReceiptFormState,
  updateReceiptFormState,
} from "../components/inventory/inventory-ui";

describe("inventory UI error states", () => {
  it("maps authentication, permission, missing and conflict responses", () => {
    expect(inventoryErrorMessage(401, "UNAUTHENTICATED")).toContain("expiró");
    expect(inventoryErrorMessage(403, "FORBIDDEN")).toContain("permiso");
    expect(inventoryErrorMessage(404, "NOT_FOUND")).toContain("no existe");
    expect(inventoryErrorMessage(409, "CONFLICT")).toContain("conflicto");
  });

  it("keeps a safe generic message for malformed or unexpected failures", () => {
    expect(inventoryErrorMessage(500, "REQUEST_FAILED")).toContain("Reintentá");
    expect(inventoryErrorMessage(422, "UNKNOWN")).toContain("Solicitud rechazada");
  });

  it("reuses one receipt command key after an ambiguous failure and rotates only on change or success", () => {
    const initial = createReceiptFormState();
    const entered = updateReceiptFormState(initial, "locationId", "location-1");
    const submittedOnce = { ...entered };
    const submittedAgain = { ...entered };

    expect(submittedAgain.idempotencyKey).toBe(submittedOnce.idempotencyKey);
    expect(updateReceiptFormState(entered, "locationId", "location-1").idempotencyKey)
      .toBe(entered.idempotencyKey);
    expect(updateReceiptFormState(entered, "quantity", "2").idempotencyKey)
      .not.toBe(entered.idempotencyKey);
    expect(resetReceiptFormState(entered).idempotencyKey).not.toBe(entered.idempotencyKey);
  });

  it("rejects malformed receipt payloads and renders invalid dates safely", () => {
    expect(() => parseInventoryResponse(receiptListResponseSchema, {
      receipts: [{ id: "not-an-uuid", quantity: "NaN" }],
    })).toThrow("Respuesta inválida del servidor.");
    expect(safeInventoryDate("not-a-date")).toBe("Fecha inválida");
  });

  it("keeps intake detail links and review checkboxes at touch-target size", () => {
    const css = readFileSync(resolve(__dirname, "../components/inventory/inventory-ui.module.css"), "utf8");
    expect(css).toMatch(/\.detailLink, \.touchTarget \{[^}]*min-height:44px/);
  });
});

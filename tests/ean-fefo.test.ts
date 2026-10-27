import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { parseWeighedEan13 } from "../src/domain/ean13";
import { selectFefoLots } from "../src/domain/fefo";
import { requirePermission, requireTenant, type Actor } from "../src/domain/actor";

function ean13(body: string): string {
  const sum = body.split("").reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

describe("weighted EAN-13", () => {
  it("parses configured weight and validates checksum", () => {
    const code = ean13("201234500125");
    const parsed = parseWeighedEan13(code, { prefix: "20", mode: "WEIGHT", variantDigits: 5, valueDigits: 5, valueScale: 3 });
    expect(parsed.variantCode).toBe("12345");
    expect(parsed.quantity?.toFixed(3)).toBe("0.125");
  });

  it("rejects malformed, wrong prefix, and invalid checksum inputs", () => {
    expect(() => parseWeighedEan13("x", { prefix: "20", mode: "WEIGHT", variantDigits: 5, valueDigits: 5, valueScale: 3 })).toThrow("INVALID_EAN13");
    expect(() => parseWeighedEan13(ean13("211234500125"), { prefix: "20", mode: "WEIGHT", variantDigits: 5, valueDigits: 5, valueScale: 3 })).toThrow("EAN13_PREFIX_MISMATCH");
    const valid = ean13("201234500125");
    const invalid = `${valid.slice(0, 12)}${valid[12] === "0" ? "1" : "0"}`;
    expect(() => parseWeighedEan13(invalid, { prefix: "20", mode: "WEIGHT", variantDigits: 5, valueDigits: 5, valueScale: 3 })).toThrow("INVALID_EAN13_CHECKSUM");
  });
});

describe("FEFO", () => {
  it("skips expired lots unless supervisor approval is present", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const lots = [
      { lotId: "expired", expiresAt: new Date("2026-01-01T00:00:00Z"), available: new Decimal(5) },
      { lotId: "fresh", expiresAt: new Date("2026-02-01T00:00:00Z"), available: new Decimal(5) },
    ];
    expect(selectFefoLots(lots, new Decimal(1), now)[0]?.lotId).toBe("fresh");
    expect(selectFefoLots(lots, new Decimal(1), now, true)[0]?.lotId).toBe("expired");
  });

  describe("Actor boundary", () => {
    const actor: Actor = { tenantId: "tenant-a", userId: "user-a", role: "ADMIN", branchIds: [], permissions: ["inventory.write"] };
    it("enforces permission and tenant context", () => {
      expect(() => requirePermission(actor, "inventory.write")).not.toThrow();
      expect(() => requireTenant(actor, "tenant-a")).not.toThrow();
      expect(() => requireTenant(actor, "tenant-b")).toThrow("TENANT_ACCESS_DENIED");
      expect(() => requirePermission({ ...actor, permissions: [] }, "inventory.write")).toThrow("FORBIDDEN");
    });
  });
});

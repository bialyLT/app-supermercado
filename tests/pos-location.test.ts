import { describe, expect, it } from "vitest";
import { resolveSinglePosLocation } from "../src/pos/location";

describe("POS location authority", () => {
  it("returns the only active authorized location", () => {
    expect(resolveSinglePosLocation([
      { id: "loc-1", active: true },
      { id: "loc-2", active: false },
    ])).toEqual({ locationId: "loc-1" });
  });

  it("blocks POS when no active location is authorized", () => {
    expect(resolveSinglePosLocation([])).toEqual({ error: "POS_LOCATION_UNAVAILABLE" });
  });

  it("blocks POS when multiple active locations are authorized", () => {
    expect(resolveSinglePosLocation([
      { id: "loc-1", active: true },
      { id: "loc-2", active: true },
    ])).toEqual({ error: "POS_LOCATION_AMBIGUOUS" });
  });
});

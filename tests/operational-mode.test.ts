import { describe, expect, it } from "vitest";
import { assertSimpleTopology, isSimpleMode, TopologyError } from "../src/domain/operational-mode";

function capture(fn: () => void): TopologyError | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    if (error instanceof TopologyError) return error;
    throw error;
  }
}

describe("simple operational topology", () => {
  it("accepts exactly one branch and one register", () => {
    expect(() => assertSimpleTopology({ branches: 1, registers: 1 })).not.toThrow();
  });

  it("rejects zero or many branches", () => {
    expect(capture(() => assertSimpleTopology({ branches: 0, registers: 1 }))?.code)
      .toBe("SIMPLE_REQUIRES_ONE_BRANCH");
    expect(capture(() => assertSimpleTopology({ branches: 2, registers: 1 }))?.code)
      .toBe("SIMPLE_REQUIRES_ONE_BRANCH");
  });

  it("rejects zero or many registers", () => {
    expect(capture(() => assertSimpleTopology({ branches: 1, registers: 0 }))?.code)
      .toBe("SIMPLE_REQUIRES_ONE_REGISTER");
    expect(capture(() => assertSimpleTopology({ branches: 1, registers: 3 }))?.code)
      .toBe("SIMPLE_REQUIRES_ONE_REGISTER");
  });

  it("reports the offending count in the message", () => {
    expect(capture(() => assertSimpleTopology({ branches: 4, registers: 1 }))?.message).toContain("4");
  });

  it("only SIMPLE is simple", () => {
    expect(isSimpleMode("SIMPLE")).toBe(true);
    expect(isSimpleMode("MULTI")).toBe(false);
  });
});

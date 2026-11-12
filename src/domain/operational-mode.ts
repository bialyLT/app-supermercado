export const OPERATIONAL_MODES = ["SIMPLE", "MULTI"] as const;

export type OperationalMode = (typeof OPERATIONAL_MODES)[number];

export type SimpleTopology = {
  readonly branches: number;
  readonly registers: number;
};

export type TopologyErrorCode =
  | "SIMPLE_REQUIRES_ONE_BRANCH"
  | "SIMPLE_REQUIRES_ONE_REGISTER";

export class TopologyError extends Error {
  constructor(public readonly code: TopologyErrorCode, message?: string) {
    super(message ?? code);
    this.name = "TopologyError";
  }
}

/**
 * SIMPLE means exactly one branch with exactly one register. Anything else is a
 * misconfigured tenant, and guessing a default would hide it: we fail loudly and
 * let the caller turn it into an actionable message.
 */
export function assertSimpleTopology({ branches, registers }: SimpleTopology): void {
  if (branches !== 1) {
    throw new TopologyError(
      "SIMPLE_REQUIRES_ONE_BRANCH",
      `El modo simple exige exactamente una sucursal (encontradas: ${branches}).`,
    );
  }
  if (registers !== 1) {
    throw new TopologyError(
      "SIMPLE_REQUIRES_ONE_REGISTER",
      `El modo simple exige exactamente una caja (encontradas: ${registers}).`,
    );
  }
}

export function isSimpleMode(mode: OperationalMode): boolean {
  return mode === "SIMPLE";
}

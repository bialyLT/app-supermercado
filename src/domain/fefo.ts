import Decimal from "decimal.js";

export type LotAvailability = Readonly<{
  lotId: string;
  expiresAt: Date | null;
  available: Decimal;
}>;

export function selectFefoLots(
  lots: readonly LotAvailability[],
  quantity: Decimal,
  now: Date,
  supervisorApproved = false,
): LotAvailability[] {
  if (quantity.lessThanOrEqualTo(0)) throw new Error("INVALID_QUANTITY");
  const sorted = [...lots].sort((a, b) => {
    if (a.expiresAt === null) return 1;
    if (b.expiresAt === null) return -1;
    return a.expiresAt.getTime() - b.expiresAt.getTime();
  });
  let remaining = quantity;
  const selected: LotAvailability[] = [];
  for (const lot of sorted) {
    if (lot.available.lessThanOrEqualTo(0)) continue;
    if (lot.expiresAt !== null && lot.expiresAt.getTime() <= now.getTime() && !supervisorApproved) {
      continue;
    }
    const taken = Decimal.min(remaining, lot.available);
    selected.push({ ...lot, available: taken });
    remaining = remaining.minus(taken);
    if (remaining.isZero()) return selected;
  }
  throw new Error("INSUFFICIENT_STOCK");
}

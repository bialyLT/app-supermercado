export type PosLocationCandidate = {
  readonly id: string;
  readonly active: boolean;
};

export type PosLocationResolution =
  | { readonly locationId: string }
  | { readonly error: "POS_LOCATION_UNAVAILABLE" | "POS_LOCATION_AMBIGUOUS" };

export function resolveSinglePosLocation(
  locations: readonly PosLocationCandidate[],
): PosLocationResolution {
  const activeLocations = locations.filter((location) => location.active);
  if (activeLocations.length === 0) return { error: "POS_LOCATION_UNAVAILABLE" };
  if (activeLocations.length > 1) return { error: "POS_LOCATION_AMBIGUOUS" };
  return { locationId: activeLocations[0].id };
}

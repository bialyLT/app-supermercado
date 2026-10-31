import { NextResponse } from "next/server";
import { requirePermission } from "../../../../src/auth/authorization";
import { getServerActor } from "../../../../src/auth/session";
import { getOperationalContext } from "../../../../src/server/context";
import { resolveSinglePosLocation } from "../../../../src/pos/location";

export async function GET() {
  try {
    await requirePermission("cash:read");
    const actor = await getServerActor();
    const context = await getOperationalContext(actor);
    const authorizedBranchIds = new Set(actor.branchIds);
    const locations = context.locations.filter(
      (location) => authorizedBranchIds.size === 0 || authorizedBranchIds.has(location.branchId),
    );
    const resolution = resolveSinglePosLocation(locations);
    if ("error" in resolution) {
      return NextResponse.json(resolution, { status: 409 });
    }
    return NextResponse.json(resolution);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}

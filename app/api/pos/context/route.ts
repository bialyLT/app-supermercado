import { NextResponse } from "next/server";
import { getServerActor } from "../../../../src/auth/session";
import { getPosSessionLocation } from "../../../../src/server/cash";
import { InventoryError } from "../../../../src/domain/inventory";
import { TopologyError } from "../../../../src/domain/operational-mode";

export async function GET() {
  try {
    const actor = await getServerActor();
    const resolution = await getPosSessionLocation(actor);
    return NextResponse.json(resolution);
  } catch (error) {
    if (error instanceof TopologyError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
    }
    if (error instanceof InventoryError) {
      if (error.code === "REGISTER_LOCATION_REQUIRED") {
        return NextResponse.json({ error: "REGISTER_LOCATION_REQUIRED" }, { status: 409 });
      }
      if (error.code === "NOT_FOUND") {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }
      if (error.code === "FORBIDDEN") {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { getServerActor } from "../../../../../src/auth/session";
import { reportFilterSources } from "../../../../../src/server/repositories/reports";

export async function GET() {
  try {
    const actor = await getServerActor();
    return NextResponse.json(await reportFilterSources(actor));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}

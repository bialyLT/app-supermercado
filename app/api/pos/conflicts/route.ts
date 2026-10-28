import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerActor } from "../../../../src/auth/session";
import { listSyncConflicts, resolveSyncConflict } from "../../../../src/server/repositories/sync-conflict";

const resolutionSchema = z.object({ status: z.enum(["RESOLVED", "REJECTED"]), resolution: z.record(z.string(), z.unknown()) }).strict();

export async function GET() {
  try { return NextResponse.json({ conflicts: await listSyncConflicts(await getServerActor()) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "REQUEST_FAILED" }, { status: 401 }); }
}

export async function PATCH(request: Request) {
  try {
    const actor = await getServerActor();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    const input = resolutionSchema.parse(await request.json());
    return NextResponse.json(await resolveSyncConflict(actor, id, input.status, input.resolution as unknown as Parameters<typeof resolveSyncConflict>[3]));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}

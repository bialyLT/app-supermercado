import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerActor } from "../../../../src/auth/session";
import { searchCatalog } from "../../../../src/server/repositories/pos";

const querySchema = z.object({ q: z.string().trim().min(1).max(80) });

export async function GET(request: Request) {
  try {
    const actor = await getServerActor();
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return NextResponse.json({ items: await searchCatalog(actor, query.q) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}

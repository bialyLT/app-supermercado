import { NextResponse } from "next/server";
import { getServerActor } from "../../../../src/auth/session";
import { createBranch } from "../../../../src/server/branches";

export async function POST(request: Request) {
  try {
    const actor = await getServerActor();
    const body = await request.json().catch(() => ({})) as { name?: string; code?: string };
    const result = await createBranch(actor, {
      name: String(body.name ?? ""),
      code: String(body.code ?? ""),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "VALIDATION") {
      return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
    }
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { getServerIdentity } from "../../../src/auth/session";

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  return NextResponse.json(identity);
}

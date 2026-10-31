import { NextResponse } from "next/server";
import { getServerActor } from "../../../../src/auth/session";
import {
  closeRegisterSession,
  closeRegisterSessionBlind,
  openRegisterSession,
  recordCashMovement,
} from "../../../../src/server/cash";

function errorResponse(error: unknown) {
  if (error instanceof Error) {
    const status = error.message === "UNAUTHENTICATED" ? 401 : error.message === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const actor = await getServerActor();
    const body = await request.json() as { action?: string; [key: string]: unknown };
    switch (body.action) {
      case "open":
        return NextResponse.json(await openRegisterSession(actor, {
          registerId: String(body.registerId ?? ""),
          openingAmount: body.openingAmount ? String(body.openingAmount) : undefined,
          openingReason: body.openingReason ? String(body.openingReason) : undefined,
          idempotencyKey: String(body.idempotencyKey ?? crypto.randomUUID()),
        }));
      case "movement":
        return NextResponse.json(await recordCashMovement(actor, {
          registerSessionId: String(body.registerSessionId ?? ""),
          type: body.type === "CASH_OUT" ? "CASH_OUT" : "CASH_IN",
          amount: String(body.amount ?? ""),
          reason: String(body.reason ?? ""),
          idempotencyKey: String(body.idempotencyKey ?? crypto.randomUUID()),
        }));
      case "blind-close":
        return NextResponse.json(await closeRegisterSessionBlind(actor, {
          registerSessionId: String(body.registerSessionId ?? ""),
          countedCashAmount: String(body.countedCashAmount ?? ""),
          reason: String(body.reason ?? ""),
          idempotencyKey: String(body.idempotencyKey ?? crypto.randomUUID()),
        }));
      case "close":
        return NextResponse.json(await closeRegisterSession(actor, {
          registerSessionId: String(body.registerSessionId ?? ""),
          idempotencyKey: String(body.idempotencyKey ?? crypto.randomUUID()),
        }));
      default:
        return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "../../../../../src/auth/authorization";
import { getServerActor } from "../../../../../src/auth/session";
import { ReportError, operationsReportQuerySchema, reportHttpStatus } from "../../../../../src/domain/reports";
import { getOperationsReport, operationsReportCsv } from "../../../../../src/server/reports";

function errorResponse(error: unknown) {
  if (error instanceof ReportError) return NextResponse.json({ error: error.code, detail: error.detail }, { status: reportHttpStatus(error) });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT", issues: error.issues }, { status: 400 });
  if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = operationsReportQuerySchema.parse({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      branchId: url.searchParams.get("branchId") ?? undefined,
      actorUserId: url.searchParams.get("actorUserId") ?? undefined,
      variantId: url.searchParams.get("variantId") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      format: url.searchParams.get("format") ?? "json",
    });
    await requirePermission("inventory:write", input.branchId);
    const actor = await getServerActor();
    const report = await getOperationsReport(actor, input);
    if (input.format === "csv") {
      return new Response(operationsReportCsv(report), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="operations-report-${input.from.slice(0, 10)}-${input.to.slice(0, 10)}.csv"`,
        },
      });
    }
    return NextResponse.json(report);
  } catch (error) {
    return errorResponse(error);
  }
}

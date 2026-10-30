import React from "react";
import type { Metadata } from "next";
import { ReportsManager } from "../../../components/reports/reports-manager";
import type {
  OperationalContext,
  OperationsReportData,
} from "../../../components/reports/types";
import { getPresetDateRange } from "../../../components/reports/types";

export const metadata: Metadata = {
  title: "Reportes Operativos - Panel Administrativo",
  description: "Consolidación tabular de ventas, compras, inventario y transferencias sin gráficos",
};

export default async function ReportsPage() {
  let initialContext: OperationalContext | null = null;
  let initialReport: OperationsReportData | null = null;

  if (process.env.DATABASE_URL) {
    try {
      const { getServerActor } = await import("../../../src/auth/session");
      const { getOperationalContext } = await import("../../../src/server/context");
      const { getOperationsReport } = await import("../../../src/server/reports");
      const actor = await getServerActor();

      const context = await getOperationalContext(actor).catch(() => null);
      if (context) {
        initialContext = {
          tenantId: context.tenantId,
          branches: context.branches.map((b) => ({
            id: b.id,
            code: b.code,
            name: b.name,
            locations: b.locations,
          })),
        };
      }

      // Prefetch current month report for fast perceived response
      const defaultRange = getPresetDateRange("thisMonth");
      const report = await getOperationsReport(actor, {
        from: defaultRange.from,
        to: defaultRange.to,
        format: "json",
      }).catch(() => null);

      if (report) {
        initialReport = report;
      }
    } catch {
      // Graceful fallback for unauthenticated or test contexts
    }
  }

  return (
    <ReportsManager
      initialContext={initialContext}
      initialReport={initialReport}
    />
  );
}

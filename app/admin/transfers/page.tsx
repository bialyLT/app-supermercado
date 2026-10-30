import type { Metadata } from "next";
import { TransferManager } from "../../../components/transfers/transfer-manager";
import type { OperationalContext, TransferSummary } from "../../../components/transfers/types";

export const metadata: Metadata = {
  title: "Transferencias - Panel Administrativo",
  description: "Despacho de stock entre sucursales con control de inventario e idempotencia",
};

export default async function TransfersPage() {
  let initialContext: OperationalContext | null = null;
  let initialTransfers: TransferSummary[] = [];

  if (process.env.DATABASE_URL) {
    try {
      const { getServerActor } = await import("../../../src/auth/session");
      const { getOperationalContext } = await import("../../../src/server/context");
      const { listTransfers } = await import("../../../src/server/transfers");
      const actor = await getServerActor();
      const [context, transfers] = await Promise.all([
        getOperationalContext(actor),
        listTransfers(actor),
      ]);
      initialContext = context;
      initialTransfers = transfers;
    } catch {
      // Graceful fallback for unauthenticated or build/test contexts.
    }
  }

  return <TransferManager initialContext={initialContext} initialTransfers={initialTransfers} />;
}

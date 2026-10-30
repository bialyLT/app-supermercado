import React from "react";
import type { Metadata } from "next";
import { PurchaseManager } from "../../../components/purchases/purchase-manager";
import type {
  OperationalContext,
  PurchaseReceiptSummary,
  Supplier,
} from "../../../components/purchases/types";

export const metadata: Metadata = {
  title: "Compras y Recepción - Panel Administrativo",
  description: "Recepción de compras directas de proveedores con control de stock e idempotencia",
};

export default async function PurchasesPage() {
  let initialSuppliers: Supplier[] = [];
  let initialReceipts: PurchaseReceiptSummary[] = [];
  let initialContext: OperationalContext | null = null;
  let defaultBranchId = "";

  if (process.env.DATABASE_URL) {
    try {
      const { getServerActor } = await import("../../../src/auth/session");
      const { listSuppliers, listPurchaseReceipts } = await import("../../../src/server/purchases");
      const { getOperationalContext } = await import("../../../src/server/context");
      const actor = await getServerActor();

      if (actor.branchIds && actor.branchIds.length > 0) {
        defaultBranchId = actor.branchIds[0];
      }

      const [rawSuppliers, rawReceipts, rawContext] = await Promise.all([
        listSuppliers(actor).catch(() => []),
        listPurchaseReceipts(actor, defaultBranchId ? { branchId: defaultBranchId } : undefined).catch(() => []),
        getOperationalContext(actor).catch(() => null),
      ]);

      if (rawContext) {
        initialContext = {
          tenantId: rawContext.tenantId,
          branches: rawContext.branches.map((b) => ({
            id: b.id,
            code: b.code,
            name: b.name,
            locations: b.locations.map((l) => ({
              id: l.id,
              code: l.code,
              name: l.name,
              type: l.type,
              branchId: l.branchId,
              active: l.active,
            })),
          })),
          locations: rawContext.locations.map((l) => ({
            id: l.id,
            code: l.code,
            name: l.name,
            type: l.type,
            branchId: l.branchId,
            active: l.active,
          })),
        };
      }

      initialSuppliers = (rawSuppliers || []).map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        taxId: s.taxId ?? null,
        email: s.email ?? null,
        phone: s.phone ?? null,
        address: s.address ?? null,
        active: s.active,
      }));

      initialReceipts = (rawReceipts || []).map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        branchId: r.branchId,
        locationId: r.locationId,
        supplierId: r.supplierId,
        receiptNumber: r.receiptNumber,
        issuedAt: r.issuedAt.toISOString(),
        receivedAt: r.receivedAt.toISOString(),
        currency: r.currency,
        subtotal: r.subtotal.toString(),
        taxTotal: r.taxTotal.toString(),
        discountTotal: r.discountTotal.toString(),
        total: r.total.toString(),
        notes: r.notes,
        idempotencyKey: r.idempotencyKey,
        supplier: r.supplier
          ? {
              id: r.supplier.id,
              code: r.supplier.code,
              name: r.supplier.name,
              taxId: r.supplier.taxId ?? null,
              email: r.supplier.email ?? null,
              phone: r.supplier.phone ?? null,
              address: r.supplier.address ?? null,
              active: r.supplier.active,
            }
          : undefined,
        lines: (r.lines || []).map((l) => ({
          id: l.id,
          variantId: l.variantId,
          lotId: l.lotId,
          quantity: l.quantity.toString(),
          unitCost: l.unitCost.toString(),
          subtotal: l.subtotal.toString(),
          taxRate: l.taxRate ? l.taxRate.toString() : null,
          taxAmount: l.taxAmount.toString(),
          discountAmount: l.discountAmount.toString(),
          total: l.total.toString(),
        })),
      }));
    } catch {
      // Graceful fallback for non-session or test contexts
    }
  }

  return (
    <PurchaseManager
      initialSuppliers={initialSuppliers}
      initialReceipts={initialReceipts}
      initialContext={initialContext}
      defaultBranchId={defaultBranchId}
    />
  );
}

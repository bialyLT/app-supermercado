import React from "react";
import type { Metadata } from "next";
import { SupplierManager, type Supplier } from "../../../components/suppliers/supplier-manager";

export const metadata: Metadata = {
  title: "Proveedores - Panel Administrativo",
  description: "Catálogo comercial de proveedores autorizados para compras y abastecimiento",
};

export default async function SuppliersPage() {
  let initialSuppliers: Supplier[] = [];

  if (process.env.DATABASE_URL) {
    try {
      const { getServerActor } = await import("../../../src/auth/session");
      const { listSuppliers } = await import("../../../src/server/purchases");
      const actor = await getServerActor();
      const raw = await listSuppliers(actor).catch(() => []);
      initialSuppliers = (raw || []).map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        taxId: s.taxId ?? null,
        email: s.email ?? null,
        phone: s.phone ?? null,
        address: s.address ?? null,
        active: s.active,
      }));
    } catch {
      // Fallback
    }
  }

  return <SupplierManager initialSuppliers={initialSuppliers} />;
}

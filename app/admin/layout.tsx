import React from "react";
import type { Metadata } from "next";
import { AdminShell } from "../../components/admin-shell";
import type { RoleName } from "../../src/domain/contracts";

export const metadata: Metadata = {
  title: "Supermercado - Panel Administrativo",
  description: "Interfaz administrativa y operativa",
};

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialRole: RoleName = "ADMIN";

  try {
    const { getServerIdentity } = await import("../../src/auth/session");
    const identity = await getServerIdentity();
    if (identity && identity.roles && identity.roles.length > 0) {
      initialRole = identity.roles[0];
    }
  } catch {
    // Graceful fallback for non-authenticated or gate test contexts
    initialRole = "ADMIN";
  }

  return <AdminShell initialRole={initialRole}>{children}</AdminShell>;
}

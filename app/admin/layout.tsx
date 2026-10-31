import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "../../components/admin-shell";
import { getServerIdentity } from "../../src/auth/session";
import { getHighestRole } from "../../src/auth/roles";

export const metadata: Metadata = {
  title: "Supermercado - Panel Administrativo",
  description: "Interfaz administrativa y operativa",
};

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let identity: Awaited<ReturnType<typeof getServerIdentity>> = null;
  try {
    identity = await getServerIdentity();
  } catch {
    redirect("/");
  }

  const initialRole = identity ? getHighestRole(identity.roles) : undefined;
  if (!initialRole) redirect("/");
  return <AdminShell initialRole={initialRole}>{children}</AdminShell>;
}

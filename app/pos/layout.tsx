import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "../../components/admin-shell";
import { getServerIdentity } from "../../src/auth/session";
import { getHighestRole } from "../../src/auth/roles";

export const metadata: Metadata = {
  title: "Supermercado - Punto de Venta",
  description: "Terminal operativa de cobro y ventas",
};

/**
 * El POS exige sesión de servidor (redirección al inicio si no hay identidad)
 * y se renderiza dentro de la shell administrativa en modo rail de 72 px
 * (badge Admin/POS, iconos con nombre accesible, expansión por foco/hover o
 * botón explícito). La shell aporta el único <main> del documento.
 */
export default async function PosLayout({
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
  return (
    <AdminShell initialRole={initialRole} rail>
      {children}
    </AdminShell>
  );
}

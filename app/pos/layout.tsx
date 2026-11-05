import React from "react";
import type { Metadata } from "next";
import { AdminShell } from "../../components/admin-shell";
import { getServerIdentity } from "../../src/auth/session";
import { getHighestRole } from "../../src/auth/roles";

export const metadata: Metadata = {
  title: "Supermercado - Punto de Venta",
  description: "Terminal operativa de cobro y ventas",
};

/**
 * S4 (revisada): el POS se renderiza dentro de la shell administrativa con la
 * barra lateral en modo rail de 72 px (badge Admin/POS, iconos con nombre
 * accesible, expansión por foco/hover o botón explícito).
 *
 * A diferencia de `/admin`, esta ruta NO redirige visitantes sin sesión: el
 * POS ya resuelve su autorización contra `/api/pos/context` y su E2E existente
 * depende de que la vista renderice sin sesión (S6: sin cambios de permisos).
 * Sin identidad, la shell muestra solo el destino POS y omite insignias de rol.
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
    identity = null;
  }

  const initialRole = identity ? getHighestRole(identity.roles) : undefined;
  return (
    <AdminShell initialRole={initialRole} rail>
      {children}
    </AdminShell>
  );
}

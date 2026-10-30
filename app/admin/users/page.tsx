import React from "react";
import type { Metadata } from "next";
import { UsersManager } from "../../../components/admin-operations/users-manager";

export const metadata: Metadata = {
  title: "Usuarios y Asignaciones - Panel Administrativo",
  description: "Gestión de personal operativo, asignación de roles y sucursales",
};

export default async function UsersPage() {
  let branches: Array<{ id: string; code: string; name: string }> = [];

  if (process.env.DATABASE_URL) {
    try {
      const { getServerActor } = await import("../../../src/auth/session");
      const { getOperationalContext } = await import("../../../src/server/context");
      const actor = await getServerActor();
      const ctx = await getOperationalContext(actor).catch(() => null);
      if (ctx) {
        branches = ctx.branches.map((b) => ({ id: b.id, code: b.code, name: b.name }));
      }
    } catch {
      // Fallback for non-authenticated or gate test contexts
    }
  }

  return <UsersManager branches={branches} />;
}

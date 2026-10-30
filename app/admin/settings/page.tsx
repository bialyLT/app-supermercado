import React from "react";
import type { Metadata } from "next";
import { SettingsManager } from "../../../components/admin-operations/settings-manager";

export const metadata: Metadata = {
  title: "Configuración - Panel Administrativo",
  description: "Parámetros operativos del tenant y directivas por sucursal",
};

export default async function SettingsPage() {
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
      // Fallback
    }
  }

  return <SettingsManager branches={branches} />;
}

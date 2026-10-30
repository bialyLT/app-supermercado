import React from "react";
import type { Metadata } from "next";
import {
  WeighedBarcodeManager,
  type WeighedBarcodeConfigState,
} from "../../../components/admin-operations/weighed-barcode-manager";

export const metadata: Metadata = {
  title: "Códigos pesables - Panel Administrativo",
  description: "Configuración de prefijo y balanzas comerciales EAN-13",
};

export default async function WeighedBarcodePage() {
  let initialConfig: Partial<WeighedBarcodeConfigState> | undefined = undefined;

  if (process.env.DATABASE_URL) {
    try {
      const { getServerActor } = await import("../../../src/auth/session");
      const { prisma } = await import("../../../src/server/repositories/client");
      const actor = await getServerActor();
      const config = await prisma.weighedBarcodeConfig.findUnique({
        where: { tenantId: actor.tenantId },
      }).catch(() => null);

      if (config) {
        initialConfig = {
          prefix: config.prefix,
          mode: config.mode as "PRICE" | "WEIGHT",
          variantDigits: config.variantDigits,
          valueDigits: config.valueDigits,
          valueScale: config.valueScale,
        };
      }
    } catch {
      // Fallback
    }
  }

  return <WeighedBarcodeManager initialConfig={initialConfig} />;
}

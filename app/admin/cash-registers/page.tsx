import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerIdentity } from "../../../src/auth/session";
import { getHighestRole } from "../../../src/auth/roles";
import { RegisterLocationManager } from "../../../components/cash-registers/register-location-manager";

export const metadata: Metadata = {
  title: "Cajas y Ubicaciones - Panel Administrativo",
  description: "Asignación ADMIN de ubicación activa por caja",
};

export default async function CashRegistersPage() {
  let identity: Awaited<ReturnType<typeof getServerIdentity>> = null;
  try {
    identity = await getServerIdentity();
  } catch {
    redirect("/");
  }
  if (!identity || getHighestRole(identity.roles) !== "ADMIN") redirect("/");
  return <RegisterLocationManager />;
}

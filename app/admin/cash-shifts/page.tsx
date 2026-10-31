import type { Metadata } from "next";
import { CashShiftsManager } from "../../../components/cash-shifts/cash-shifts-manager";

export const metadata: Metadata = {
  title: "Arqueos y Turnos - Panel Administrativo",
  description: "Operaciones auditadas de apertura, movimientos y cierre de caja",
};

export default function CashShiftsPage() {
  return <CashShiftsManager />;
}

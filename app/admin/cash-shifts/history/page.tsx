import type { Metadata } from "next";
import { OperationalRead } from "../../../../components/operational-read/operational-read";
export const metadata: Metadata = { title: "Historial de caja - Panel Administrativo" };
export default function CashHistoryPage() { return <OperationalRead surface="cash" />; }

import type { Metadata } from "next";
import { OperationalRead } from "../../../components/operational-read/operational-read";
export const metadata: Metadata = { title: "Ventas - Panel Administrativo" };
export default function SalesPage() { return <OperationalRead surface="sales" />; }

import type { Metadata } from "next";
import { OperationalRead } from "../../../components/operational-read/operational-read";
export const metadata: Metadata = { title: "Inventario - Panel Administrativo" };
export default function InventoryPage() { return <OperationalRead surface="inventory" />; }

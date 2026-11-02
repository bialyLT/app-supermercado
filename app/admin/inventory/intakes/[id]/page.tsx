import type { Metadata } from "next";
import { IntakeDetailPage } from "../../../../../components/inventory/inventory-ui";
export const metadata: Metadata = { title: "Detalle de intake - Inventario" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <IntakeDetailPage id={(await params).id} />; }

import type { Metadata } from "next";
import { SaleDetail } from "../../../../components/operational-read/operational-read";
export const metadata: Metadata = { title: "Detalle de venta - Panel Administrativo" };
export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) { return <SaleDetail saleId={(await params).id} />; }

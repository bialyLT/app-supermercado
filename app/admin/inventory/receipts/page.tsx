import type { Metadata } from "next";
import { ReceiptsPage } from "../../../../components/inventory/inventory-ui";
export const metadata: Metadata = { title: "Recepciones - Inventario" };
export default function Page() { return <ReceiptsPage />; }

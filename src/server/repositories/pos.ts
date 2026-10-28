import { inventoryTransaction, systemClock } from "./inventory";
import type { Actor } from "../../domain/actor";

export async function searchCatalog(actor: Actor, query: string) {
  const normalized = query.trim();
  if (!normalized) return [];
  return inventoryTransaction(actor, "inventory.catalog.read", systemClock, async (tx, verified) => {
    const variants = await tx.productVariant.findMany({
      where: { tenantId: verified.tenantId, active: true, OR: [
        { sku: { contains: normalized, mode: "insensitive" } },
        { name: { contains: normalized, mode: "insensitive" } },
        { product: { name: { contains: normalized, mode: "insensitive" } } },
        { barcodes: { some: { code: normalized, active: true } } },
      ] },
      include: { product: true }, take: 20, orderBy: { name: "asc" },
    });
    return variants.map((variant) => ({ id: variant.id, sku: variant.sku, name: variant.name, productName: variant.product.name }));
  });
}

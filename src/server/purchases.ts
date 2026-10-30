import type { Actor } from "../domain/actor";
import {
  type DirectPurchaseReceiptInput,
  type SupplierInput,
  directPurchaseReceiptInputSchema,
  supplierInputSchema,
} from "../domain/purchases";
import * as repository from "./repositories/purchases";

export { systemClock, type Clock } from "./repositories/purchases";

export async function createDirectPurchaseReceipt(
  actor: Actor,
  input: DirectPurchaseReceiptInput,
  clock: repository.Clock = repository.systemClock,
) {
  const parsed = directPurchaseReceiptInputSchema.parse(input);
  return repository.createDirectPurchaseReceipt(actor, parsed, clock);
}

export async function createSupplier(actor: Actor, input: SupplierInput) {
  const parsed = supplierInputSchema.parse(input);
  return repository.createSupplier(actor, parsed);
}

export async function listSuppliers(actor: Actor) {
  return repository.listSuppliers(actor);
}

export async function getSupplier(actor: Actor, id: string) {
  return repository.getSupplier(actor, id);
}

export async function listPurchaseReceipts(
  actor: Actor,
  filters?: { branchId?: string; supplierId?: string },
) {
  return repository.listPurchaseReceipts(actor, filters);
}

export async function getPurchaseReceipt(actor: Actor, id: string) {
  return repository.getPurchaseReceipt(actor, id);
}

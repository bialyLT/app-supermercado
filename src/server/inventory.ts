import type { z } from "zod";
import type { Actor } from "../domain/actor";
import { InventoryError, multiSaleSchema, receiptSchema, saleSchema, reservationSchema, releaseSchema, reviewSchema } from "../domain/inventory";
import * as repository from "./repositories/inventory";

export async function execute<T>(actor: Actor, clock: repository.Clock, operation: () => Promise<T>) {
  try { return await operation(); }
  catch (error) {
    if (error instanceof InventoryError && error.code !== "UNAUTHENTICATED") {
      await repository.auditDenial(actor, error.code, clock);
    }
    throw error;
  }
}

export function listInventoryAlerts(actor: Actor, clock = repository.systemClock) {
  return execute(actor, clock, () => repository.alerts(actor, clock));
}

export function recordReceipt(actor: Actor, input: z.input<typeof receiptSchema>, clock = repository.systemClock) {
  return execute(actor, clock, () => repository.receipt(actor, receiptSchema.parse(input), clock));
}
export function confirmSale(actor: Actor, input: z.input<typeof saleSchema>, clock = repository.systemClock) {
  return execute(actor, clock, () => repository.sale(actor, saleSchema.parse(input), clock));
}
export function confirmMultiLineSale(actor: Actor, input: z.input<typeof multiSaleSchema>, clock = repository.systemClock) {
  return execute(actor, clock, () => repository.multiSale(actor, multiSaleSchema.parse(input), clock));
}
export function reserveStock(actor: Actor, input: z.input<typeof reservationSchema>, clock = repository.systemClock) {
  return execute(actor, clock, () => repository.reserve(actor, reservationSchema.parse(input), clock));
}
export function releaseReservation(actor: Actor, input: z.input<typeof releaseSchema>, clock = repository.systemClock) {
  return execute(actor, clock, () => repository.release(actor, releaseSchema.parse(input), clock));
}
export function reviewUnverifiedIntake(actor: Actor, input: z.input<typeof reviewSchema>, clock = repository.systemClock) {
  return execute(actor, clock, () => repository.review(actor, reviewSchema.parse(input), clock));
}

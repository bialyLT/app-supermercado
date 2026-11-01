import { z } from "zod";
import type { Actor } from "../domain/actor";
import * as repository from "./repositories/operational-read";

export const operationalReadQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && new Date(value.to).getTime() <= new Date(value.from).getTime()) {
    context.addIssue({ code: "custom", path: ["to"], message: "DATE_RANGE_INVERTED" });
  }
});

export type OperationalReadQuery = z.output<typeof operationalReadQuerySchema>;
export const listInventoryLevels = (actor: Actor, query: OperationalReadQuery) => repository.listInventoryLevels(actor, query);
export const listInventoryMovements = (actor: Actor, query: OperationalReadQuery) => repository.listInventoryMovements(actor, query);
export const listSales = (actor: Actor, query: OperationalReadQuery) => repository.listSales(actor, query);
export const getSale = (actor: Actor, id: string) => repository.getSale(actor, id);
export const listCashShifts = (actor: Actor, query: OperationalReadQuery) => repository.listCashShifts(actor, query);

import type { z } from "zod";
import type { Actor } from "../domain/actor";
import { openSessionSchema, closeSessionSchema, cashMovementSchema, blindCloseSchema, policySchema } from "../domain/cash";
import * as repository from "./repositories/cash";
import { systemClock } from "./repositories/inventory";
import { execute } from "./inventory";

export function configureInventoryPolicy(actor: Actor, input: z.input<typeof policySchema>, clock = systemClock) {
  return execute(actor, clock, () => repository.configure(actor, policySchema.parse(input), clock));
}
export function openRegisterSession(actor: Actor, input: z.input<typeof openSessionSchema>, clock = systemClock) {
  return execute(actor, clock, () => repository.open(actor, openSessionSchema.parse(input), clock));
}
export function recordCashMovement(actor: Actor, input: z.input<typeof cashMovementSchema>, clock = systemClock) {
  return execute(actor, clock, () => repository.recordMovement(actor, cashMovementSchema.parse(input), clock));
}
export function closeRegisterSession(actor: Actor, input: z.input<typeof closeSessionSchema>, clock = systemClock) {
  return execute(actor, clock, () => repository.close(actor, closeSessionSchema.parse(input), clock));
}
export function closeRegisterSessionBlind(actor: Actor, input: z.input<typeof blindCloseSchema>, clock = systemClock) {
  return execute(actor, clock, () => repository.closeBlind(actor, blindCloseSchema.parse(input), clock));
}

import type { z } from "zod";
import type { Actor } from "../domain/actor";
import { setPinSchema, approvalSchema } from "../domain/approval";
import * as repository from "./repositories/approval";
import { systemClock } from "./repositories/inventory";
import { execute } from "./inventory";

export function setSupervisorPin(actor: Actor, input: z.input<typeof setPinSchema>, clock = systemClock) {
  return execute(actor, clock, () => repository.setPin(actor, setPinSchema.parse(input).pin, clock));
}
export function approveInventorySale(actor: Actor, input: z.input<typeof approvalSchema>, clock = systemClock) {
  return execute(actor, clock, () => repository.issue(actor, approvalSchema.parse(input), clock));
}

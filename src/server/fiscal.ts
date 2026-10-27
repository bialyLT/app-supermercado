import type { z } from "zod";
import type { Actor } from "../domain/actor";
import { fiscalProfileSchema } from "../domain/fiscal";
import { execute } from "./inventory";
import { systemClock } from "./repositories/inventory";
import * as repository from "./repositories/fiscal";

export function configureFiscalProfile(actor: Actor, input: z.input<typeof fiscalProfileSchema>, clock = systemClock) {
  return execute(actor, clock, () => repository.configure(actor, fiscalProfileSchema.parse(input), clock));
}
export function getFiscalProfile(actor: Actor, branchId: string, clock = systemClock) {
  return execute(actor, clock, () => repository.getForBranch(actor, branchId, clock));
}

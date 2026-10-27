import type { z } from "zod";
import type { Actor } from "../domain/actor";
import { reversalSchema } from "../domain/reversal";
import * as repository from "./repositories/reversal";
import { execute } from "./inventory";
import { systemClock, type Clock } from "./repositories/inventory";

export function reverseSale(actor: Actor, input: z.input<typeof reversalSchema>, clock: Clock = systemClock) {
  return execute(actor, clock, () => repository.reverse(actor, reversalSchema.parse(input), clock));
}

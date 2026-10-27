import type { z } from "zod";
import type { Actor } from "../domain/actor";
import { closureSchema } from "../domain/numbering";
import * as repository from "./repositories/numbering";
import { execute } from "./inventory";
import { systemClock, type Clock } from "./repositories/inventory";

export function closeBranchDocuments(actor: Actor, input: z.input<typeof closureSchema>, clock: Clock = systemClock) {
  return execute(actor, clock, () => repository.closeDocuments(actor, closureSchema.parse(input), clock));
}

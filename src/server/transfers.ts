import type { Actor } from "../domain/actor";
import { transferInputSchema, type TransferInput } from "../domain/transfers";
import * as repository from "./repositories/transfers";

export { systemClock, type Clock } from "./repositories/transfers";

export async function createTransfer(actor: Actor, input: TransferInput, clock: repository.Clock = repository.systemClock) {
  return repository.createTransfer(actor, transferInputSchema.parse(input), clock);
}

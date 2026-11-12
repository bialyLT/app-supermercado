import type { Actor } from "../domain/actor";
import * as repository from "./repositories/branches";

export type { CreateBranchInput } from "./repositories/branches";

export function createBranch(actor: Actor, input: repository.CreateBranchInput) {
  return repository.createBranch(actor, input);
}

import type { Actor } from "../domain/actor";
import * as repository from "./repositories/context";

export {
  ContextError,
  contextHttpStatus,
  verifyContextPermission,
  type OperationalBranch,
  type OperationalLocation,
  type OperationalContext,
} from "./repositories/context";

export async function getOperationalContext(actor: Actor): Promise<repository.OperationalContext> {
  return repository.getOperationalContext(actor);
}

import type { RoleName } from "../domain/contracts";

const rolePrecedence: readonly RoleName[] = ["ADMIN", "STOCK_MANAGER", "SUPERVISOR", "CASHIER"];

export function getHighestRole(roles: readonly RoleName[]): RoleName | undefined {
  return rolePrecedence.find((candidate) => roles.includes(candidate));
}

import type { Actor } from "../domain/actor";
import { operationsReportQuerySchema, type OperationsReportQuery } from "../domain/reports";
import * as repository from "./repositories/reports";

export type { OperationsReport } from "./repositories/reports";

export async function getOperationsReport(actor: Actor, input: OperationsReportQuery) {
  return repository.operationsReport(actor, operationsReportQuerySchema.parse(input));
}

export { operationsReportCsv } from "./repositories/reports";

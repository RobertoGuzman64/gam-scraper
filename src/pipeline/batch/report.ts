import type { ProviderRun, BatchReport } from "./report-types.js";
export type { ProviderRun, BatchReport, PublicationStats } from "./report-types.js";
export { readPublicationStats } from "../publication/publication-stats.js";
export { writeBatchReport } from "./report-persistence.js";

export const getBatchStatus = (runs: readonly ProviderRun[]): BatchReport["status"] => {
  const successes = runs.filter((run) => run.status === "complete").length;
  return successes === runs.length && runs.length > 0 ? "complete" : successes === 0 ? "failed" : "partial";
};

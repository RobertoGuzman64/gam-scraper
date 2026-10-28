import type { ImportCandidate } from "../legacy-export/contracts.js";

export type PreparedProduct = {
  readonly status: "ready" | "review";
  readonly issues: readonly string[];
  readonly importIssues?: {
    readonly excel: readonly string[];
    readonly createMany: readonly string[];
  };
  readonly product: ImportCandidate;
};

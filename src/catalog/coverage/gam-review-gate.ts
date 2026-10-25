import type { CanonicalCatalog } from "../canonical-catalog.js";
import { compareCanonicalCoverage } from "./compare.js";
import { createCoverageReview, verifyCoverageReview } from "./review.js";
import type { CoverageReview } from "./review.js";

const missingReferences = ["6942", "6948", "6366", "6676"] as const;

export const assessNewGamCoverage = (
  baseline: CanonicalCatalog,
  current: CanonicalCatalog,
  baselineSha256: string,
  currentSha256: string,
  decision: unknown
): CoverageReview => {
  if (baseline.providerId !== "gam" || current.providerId !== "gam") {
    throw new Error("F50: la revisión de cobertura corresponde únicamente a GAM");
  }
  const difference = compareCanonicalCoverage(baseline, current);
  const report = createCoverageReview(baseline, current, baselineSha256, currentSha256);
  const missing = new Set(report.missing.map(({ reference }) => reference));
  if (difference.added.length !== 0 || report.missing.length !== missingReferences.length || report.changed.length !== 24 ||
    missing.size !== missingReferences.length ||
    missingReferences.some((reference) => !missing.has(reference))) {
    throw new Error("F50: la cobertura no coincide con las cuatro ausencias y los 24 cambios observados");
  }
  if (decision !== undefined) verifyCoverageReview(decision, report);
  return report;
};

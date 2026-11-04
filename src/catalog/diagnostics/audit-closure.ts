import type { DescriptionCoverage } from "./description-coverage.js";
import type { DescriptionPriorities } from "./description-priorities.js";
import type { SpecificationCoverage } from "./specification-coverage.js";

export const hasUnresolvedCatalogAuditContracts = (
  coverage: DescriptionCoverage, priorities: DescriptionPriorities, specifications: SpecificationCoverage
): boolean => {
  const { pending, lost } = coverage.totals;
  const technical = specifications.totals;
  return coverage.totals.incompleteProducts > 0 || pending.description > 0 || pending.description_general > 0 ||
    lost.description > 0 || lost.description_general > 0 ||
    priorities.totals.pendingByStage.P0 > 0 || priorities.totals.technical > 0 ||
    technical.sourceNotPreserved > 0 || technical.lostAfterPublication > 0 ||
    technical.ambiguousNormalization > 0 || technical.pendingPublication > 0;
};

export const hasCompleteCatalogAuditEvidence = (
  coverage: DescriptionCoverage, specifications: SpecificationCoverage
): boolean => coverage.totals.products > 0 &&
  coverage.totals.products === specifications.totals.products &&
  specifications.totals.canonicalOriginals === specifications.totals.products &&
  specifications.totals.reconstructedSources === 0;

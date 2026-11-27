import type { DescriptionCoverage } from "../coverage/description-coverage.js";
import type { DescriptionPriorities } from "../coverage/description-priorities.js";
import type { SpecificationCoverage } from "../coverage/specification-coverage.js";

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
  specifications.totals.partialOriginals === 0 && specifications.totals.reconstructedSources === 0;

export const assessCatalogAuditClosure = (
  coverage: DescriptionCoverage, priorities: DescriptionPriorities, specifications: SpecificationCoverage, completePopulation: boolean
) => {
  const unresolved = hasUnresolvedCatalogAuditContracts(coverage, priorities, specifications);
  const completeEvidence = hasCompleteCatalogAuditEvidence(coverage, specifications);
  return { status: unresolved ? "requiere_intervencion" as const : !completePopulation || !completeEvidence ?
    "alcance_limitado" as const : "conforme_en_alcance_comparado" as const, unresolved, completePopulation, completeEvidence };
};

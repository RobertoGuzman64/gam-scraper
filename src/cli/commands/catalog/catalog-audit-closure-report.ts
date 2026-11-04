import { hasCompleteCatalogAuditEvidence, hasUnresolvedCatalogAuditContracts } from "../../../catalog/diagnostics/audit-closure.js";
import type { DescriptionCoverage } from "../../../catalog/diagnostics/description-coverage.js";
import type { DescriptionPriorities } from "../../../catalog/diagnostics/description-priorities.js";
import type { SpecificationCoverage } from "../../../catalog/diagnostics/specification-coverage.js";

export const formatCatalogAuditClosureReport = (
  coverage: DescriptionCoverage, priorities: DescriptionPriorities, specifications: SpecificationCoverage
): readonly string[] => {
  const pending = coverage.totals.pending.description + coverage.totals.pending.description_general;
  const lost = coverage.totals.lost.description + coverage.totals.lost.description_general;
  const technical = specifications.totals;
  const lines = [
    `CIERRE AUDITOR | descripciones pendientes ${pending} | pérdidas de descripción ${lost} | incidencias de preparación ${priorities.totals.technical}`,
    `CIERRE AUDITOR | diferencias técnicas ${technical.sourceNotPreserved} | pérdidas técnicas ${technical.lostAfterPublication} | ambigüedades ${technical.ambiguousNormalization} | pendientes de publicar ${technical.pendingPublication}`
  ];
  if (hasUnresolvedCatalogAuditContracts(coverage, priorities, specifications)) {
    lines.push("CIERRE AUDITOR | REQUIERE INTERVENCIÓN: hay contratos pendientes; revisar los casos existentes del informe");
  } else if (!hasCompleteCatalogAuditEvidence(coverage, specifications)) {
    lines.push("CIERRE AUDITOR | ALCANCE LIMITADO: faltan originales canónicos o fichas comparables; no se acredita cierre técnico completo");
  } else {
    lines.push(`CIERRE AUDITOR | CONFORME EN ALCANCE COMPARADO: ${coverage.totals.products} fichas, sin incidencias obligatorias abiertas`);
  }
  lines.push(`CIERRE AUDITOR | ${technical.observationalMissing} observaciones familiares no obligatorias | ${priorities.totals.pendingByStage.P1 + priorities.totals.pendingByStage.P2} prioridades P1/P2 orientativas: no abren tareas por sí solas`);
  return lines;
};

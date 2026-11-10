import type { FindingRecognitionClassification } from "../../catalog/diagnostics/finding-recognitions.js";
import type { PresentationConsistencyAudit } from "../../commercial/diagnostics/presentation-consistency.js";
import { printReportLine } from "./terminal.js";

export const printPreparationCoherenceReport = (
  report: PresentationConsistencyAudit, classified: FindingRecognitionClassification
): void => {
  const observed = new Map(classified.findings.map((item) => [JSON.stringify([
    item.finding.providerId, item.finding.reference, item.finding.sourceUrl,
    item.finding.field, item.finding.code
  ]), item]));
  if (observed.size !== classified.findings.length || classified.findings.length !== report.reviews) {
    throw new Error("Revisiones de preparación sin clasificación individual única");
  }
  const controlled = classified.findings.filter((item) => item.status === "controlled").length;
  printReportLine(`COHERENCIA DE PREPARACIÓN | ${report.products} fichas | ${report.defects} defectos | ${report.reviews} casos para revisar`);
  for (const finding of report.findings) {
    const identity = JSON.stringify([finding.providerId, finding.reference, finding.sourceUrl,
      finding.field, finding.code]);
    const item = finding.status === "revisar" ? observed.get(identity) : undefined;
    if (finding.status === "revisar" && !item) throw new Error(`Revisión sin clasificación: ${identity}`);
    printReportLine(`  ${item?.status === "controlled" ? "CONTROLADA" : finding.status.toUpperCase()} ${finding.providerId}:${finding.reference ?? finding.sourceUrl} | ${finding.field} | ${finding.code}${item ? ` | huella ${item.fingerprint}` : ""}`);
  }
  printReportLine(`COHERENCIA INDIVIDUAL | pendientes ${report.reviews - controlled} | controladas ${controlled} | reconocimientos caducados ${classified.stale.length}`);
};

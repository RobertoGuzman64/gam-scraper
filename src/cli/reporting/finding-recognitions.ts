import type { ClassifiedFinding, FindingRecognition } from "../../catalog/diagnostics/finding-recognitions.js";
import { printReportLine } from "./terminal.js";

export const printStaleFindingRecognitions = (stale: readonly FindingRecognition[]): void => {
  for (const recognition of stale) {
    const finding = recognition.finding;
    printReportLine(`  RECONOCIMIENTO CADUCADO | ${finding.providerId}:${finding.reference ?? finding.sourceUrl} | ${finding.code} | huella ${recognition.fingerprint}`);
  }
};

export const printClassifiedAccreditationFindings = (
  providerId: string, findings: readonly ClassifiedFinding[]
): void => {
  const observed = findings.filter((item) => item.finding.providerId === providerId &&
    item.finding.audit === "acreditacion_comercial");
  const pending = observed.filter((item) => item.status === "pending").length;
  printReportLine(`  INCIDENCIAS ACREDITACIÓN | pendientes ${pending} | controladas ${observed.length - pending}`);
  for (const item of observed) {
    printReportLine(`    ${item.status === "controlled" ? "CONTROLADA" : "PENDIENTE"} | ${item.finding.reference ?? item.finding.sourceUrl} | ${item.finding.code} | ${item.finding.field} | huella ${item.fingerprint}`);
  }
};

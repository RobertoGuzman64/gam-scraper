import { classifyFindingRecognitions } from "./finding-recognitions.js";
import type { AuditedFinding, FindingRecognitionClassification, FindingRecognitionRegistry } from "./finding-recognitions.js";

export const classifyCurrentAuditFindings = (
  observed: readonly AuditedFinding[], registry: FindingRecognitionRegistry,
  audit: AuditedFinding["audit"]
): FindingRecognitionClassification => {
  if (observed.some((finding) => finding.audit !== audit)) {
    throw new Error("Hallazgos ajenos al auditor solicitado");
  }
  return classifyFindingRecognitions(observed, {
    version: registry.version,
    recognitions: registry.recognitions.filter((recognition) => recognition.finding.audit === audit)
  });
};

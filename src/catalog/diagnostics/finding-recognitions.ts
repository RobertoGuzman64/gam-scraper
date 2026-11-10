import { createHash } from "node:crypto";

export type AuditedFinding = {
  readonly providerId: string;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly field: string;
  readonly code: string;
  readonly evidenceSha256: string;
  readonly facts: readonly { readonly name: string; readonly value: string }[];
} & ({
  readonly audit: "coherencia_preparacion";
  readonly severity: "revisar";
} | {
  readonly audit: "acreditacion_comercial";
  readonly severity: "warn";
});

export type FindingRecognition = {
  readonly finding: AuditedFinding;
  readonly fingerprint: string;
  readonly decision: {
    readonly reviewedBy: string;
    readonly reviewedAt: string;
    readonly rationale: string;
    readonly evidence: readonly { readonly origin: string; readonly content: string }[];
  };
};

export type FindingRecognitionRegistry = {
  readonly version: 1;
  readonly recognitions: readonly FindingRecognition[];
};

export type ClassifiedFinding = {
  readonly finding: AuditedFinding;
  readonly fingerprint: string;
  readonly status: "pending" | "controlled";
  readonly recognition: FindingRecognition | null;
};

export type FindingRecognitionClassification = {
  readonly findings: readonly ClassifiedFinding[];
  readonly stale: readonly FindingRecognition[];
};

const digest = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const validText = (value: string): boolean => value.trim().length > 0 && value === value.trim();
const hasContent = (value: string): boolean => value.trim().length > 0;

const validateFinding = (finding: AuditedFinding): void => {
  if (![finding.providerId, finding.sourceUrl, finding.field, finding.code].every(validText) ||
    !((finding.audit === "coherencia_preparacion" && finding.severity === "revisar") ||
      (finding.audit === "acreditacion_comercial" && finding.severity === "warn")) ||
    (finding.reference !== null && !validText(finding.reference)) ||
    !/^[a-f0-9]{64}$/u.test(finding.evidenceSha256) || finding.facts.length < 2 ||
    finding.facts.some((fact) => !validText(fact.name) || !hasContent(fact.value)) ||
    new Set(finding.facts.map((fact) => fact.name)).size !== finding.facts.length) {
    throw new Error("Hallazgo sin identidad o hechos de evidencia verificables");
  }
};

export const fingerprintAuditedFinding = (finding: AuditedFinding): string => {
  validateFinding(finding);
  return digest(JSON.stringify({
    providerId: finding.providerId, reference: finding.reference, sourceUrl: finding.sourceUrl,
    audit: finding.audit, severity: finding.severity, field: finding.field, code: finding.code,
    evidenceSha256: finding.evidenceSha256,
    facts: [...finding.facts].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  }));
};

export const validateFindingRecognitionRegistry = (registry: FindingRecognitionRegistry): void => {
  if (registry.version !== 1) throw new Error("Versión de reconocimientos no compatible");
  const keys = new Set<string>();
  for (const recognition of registry.recognitions) {
    const fingerprint = fingerprintAuditedFinding(recognition.finding);
    const decision = recognition.decision;
    if (recognition.fingerprint !== fingerprint || !validText(decision.reviewedBy) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(decision.reviewedAt) ||
      !Number.isFinite(Date.parse(decision.reviewedAt)) || !validText(decision.rationale) ||
      decision.evidence.length === 0 || decision.evidence.some((item) =>
        !validText(item.origin) || !hasContent(item.content))) {
      throw new Error("Reconocimiento sin huella, revisión o evidencia válida");
    }
    if (keys.has(fingerprint)) throw new Error("Reconocimientos duplicados para la misma incidencia");
    keys.add(fingerprint);
  }
};

export const classifyFindingRecognitions = (
  observed: readonly AuditedFinding[], registry: FindingRecognitionRegistry
): FindingRecognitionClassification => {
  validateFindingRecognitionRegistry(registry);
  const recognized = new Map(registry.recognitions.map((item) => [item.fingerprint, item]));
  const active = new Set<string>();
  const findings = observed.map((finding): ClassifiedFinding => {
    const fingerprint = fingerprintAuditedFinding(finding);
    const recognition = recognized.get(fingerprint) ?? null;
    if (recognition !== null) active.add(fingerprint);
    return { finding, fingerprint, status: recognition === null ? "pending" : "controlled", recognition };
  });
  return { findings, stale: registry.recognitions.filter((item) => !active.has(item.fingerprint)) };
};

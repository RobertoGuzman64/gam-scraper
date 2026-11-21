import { matchesTechnicalDocumentVerification } from "../../contracts/technical-provenance.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { PanelProviderEvidence } from "../evidence/types.js";
import { originalRecordFingerprint } from "../evidence/spec-addition-audit.js";
import type { AuditEntry, SpecAdditionAudit } from "../evidence/spec-addition-audit.js";
import type { PanelFieldDifference, PanelFieldProvenance, PanelSpecAddition } from "./types.js";
import { sourceYearEvidence } from "./source-year-evidence.js";
import { sourceTechnicalEvidence } from "./source-technical-evidence.js";
export { loadSpecAdditionAudit } from "../evidence/spec-addition-audit.js";
export type { SpecAdditionAudit } from "../evidence/spec-addition-audit.js";

export const classifySpecAdditions = (
  changes: readonly PanelFieldDifference[], provider: PanelProviderEvidence,
  reference: string | null, sourceUrl: string, audit: SpecAdditionAudit | null,
  original?: ProductRecord | null, provenance: readonly PanelFieldProvenance[] = []
): readonly PanelSpecAddition[] => {
  const found = new Map<string, AuditEntry>();
  const cut = audit?.cuts[provider.providerId];
  if (audit && cut && provider.original.status === "verified") {
    const unchangedOriginal = cut.originalSha256 === provider.original.artifact.sha256;
    const fingerprint = audit.version === 2 && original ? originalRecordFingerprint(original) : null;
    const entries: readonly AuditEntry[] = audit.version === 1
      ? unchangedOriginal ? audit.entries : []
      : fingerprint !== null ? audit.entries.filter((entry) => entry.originalRecordSha256 === fingerprint)
        : unchangedOriginal ? audit.entries : [];
    for (const entry of entries) {
      if (entry.providerId === provider.providerId && entry.reference === reference && entry.sourceUrl === sourceUrl) {
        found.set(entry.field, entry);
      }
    }
  }
  return changes.filter((difference) => difference.group === "technical" && difference.change === "added")
    .map((difference): PanelSpecAddition => {
      const entry = found.get(difference.field);
      const proof = provenance.find((evidence) => evidence.group === "technical" &&
        evidence.field === difference.field && (evidence.status === "source-compatible" ||
          evidence.status === "mechanism-compatible" && evidence.scope === "model-document" &&
            evidence.verification !== undefined));
      const source = proof?.historicalApplication === "demonstrated"
        ? proof.sourceField && proof.sourceValue && proof.scope === "unit"
          ? { sourceField: proof.sourceField, sourceValue: proof.sourceValue, mechanism: proof.mechanism }
          : null
        : original ? sourceYearEvidence(original, difference.field, difference.after) ??
          sourceTechnicalEvidence(original, difference.field, difference.after) : null;
      const verifiedOwn = original !== null && original !== undefined && source !== null &&
        original.providerId === provider.providerId && original.reference === reference && original.url === sourceUrl &&
        provider.original.status === "verified" && proof !== undefined &&
        proof.scope === "unit" && proof.sourceField === source.sourceField &&
        proof.sourceValue === source.sourceValue && proof.mechanism === source.mechanism &&
        proof.originalSha256 === provider.original.artifact.sha256 &&
        proof.publicationSha256 === provider.publication.sha256 &&
        proof.proof?.path === provider.original.artifact.path && proof.proof.sha256 === provider.original.artifact.sha256;
      const verifiedShared = original !== null && original !== undefined &&
        original.providerId === provider.providerId && original.reference === reference && original.url === sourceUrl &&
        provider.original.status === "verified" && proof !== undefined &&
        proof.scope === "model-document" && proof.verification?.kind === "reviewed-model-fact" &&
        proof.historicalApplication === "demonstrated" &&
        proof.originalSha256 === provider.original.artifact.sha256 &&
        proof.publicationSha256 === provider.publication.sha256 &&
        proof.document?.brand === original.brand && proof.document.model === original.model &&
        matchesTechnicalDocumentVerification(proof.document, difference.field, difference.after ?? "", proof.verification);
      return { field: difference.field, value: difference.after ?? "",
        kind: entry && entry.value === difference.after ? entry.kind :
          verifiedOwn ? "own" : verifiedShared ? "reused" : "pending" };
    });
};

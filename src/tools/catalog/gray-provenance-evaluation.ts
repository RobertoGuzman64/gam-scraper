import type { ProductRecord } from "../../contracts/catalog.js";
import type { TechnicalSpecEvidence } from "../../contracts/technical-provenance.js";
import { matchesDocumentedTechnicalIdentity } from "../../preparation/shared/technical/evidence/reviewed-catalog-model-identity.js";

export type GrayProvenanceBlocker =
  | "not-reproduced"
  | "unattributed"
  | "partial-document-identity"
  | "original-listing-without-value-proof"
  | "unit-document-not-verified"
  | "model-document-not-verified"
  | "original-field-replay-not-published";

export type GrayProvenanceEvaluation = {
  readonly blocker: GrayProvenanceBlocker;
  readonly scope: TechnicalSpecEvidence["scope"] | null;
  readonly mechanism: string | null;
  readonly documentUrl: string | null;
  readonly sourceField: string | null;
};

export const evaluateGrayProvenance = (
  original: ProductRecord, field: string, value: string,
  evidence: TechnicalSpecEvidence | undefined
): GrayProvenanceEvaluation => {
  if (!evidence) return { blocker: "not-reproduced", scope: null, mechanism: null,
    documentUrl: null, sourceField: null };
  if (evidence.field !== field || evidence.value !== value) {
    throw new Error("Evidencia técnica incompatible con la incorporación gris");
  }
  const base = { scope: evidence.scope, mechanism: evidence.mechanism };
  if (evidence.scope === "unknown") {
    return { ...base, blocker: "unattributed", documentUrl: null, sourceField: null };
  }
  if (evidence.scope === "unit") {
    const source = evidence.sourceField === "year" ? original.year :
      evidence.sourceField === "longDescription" ? original.longDescription :
        original.specs?.[evidence.sourceField];
    if (source !== evidence.sourceValue) {
      throw new Error("Evidencia de procedencia propia incongruente con el original");
    }
    return { ...base, blocker: "original-field-replay-not-published",
      documentUrl: null, sourceField: evidence.sourceField };
  }
  if (!matchesDocumentedTechnicalIdentity(original, evidence)) {
    throw new Error("Evidencia documental incongruente con la identidad de la ficha");
  }
  if (evidence.scope === "document-reference") {
    return { ...base, blocker: "partial-document-identity",
      documentUrl: evidence.document.url, sourceField: null };
  }
  if (evidence.scope === "unit-document") {
    return { ...base, blocker: evidence.document.url === original.url
      ? "original-listing-without-value-proof" : "unit-document-not-verified",
      documentUrl: evidence.document.url, sourceField: null };
  }
  return { ...base, blocker: "model-document-not-verified",
    documentUrl: evidence.document.url, sourceField: null };
};

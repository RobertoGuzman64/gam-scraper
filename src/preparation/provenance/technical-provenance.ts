import type { ProductRecord, SpecsMap, SpecValue } from "../../contracts/catalog.js";
import { normalizeSpecKey } from "../../catalog/normalization/normalize-specs.js";
import { isGamUnitUrl } from "../../catalog/normalization/gam/unit-url.js";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";

import type { DocumentedTechnicalSource, ProductTechnicalProvenance, TechnicalSpecEvidence } from "../../contracts/technical-provenance.js";
import type { TechnicalRecoverySourceField } from "./technical-recovery-observation.js";
import { reviewedModelDocumentVerification } from "../technical/reviewed-model-claims.js";
import { reviewedUnitDescriptionEvidence } from "../technical/reviewed-unit-description-claims.js";
import { reviewedUnitListingVerification } from "../technical/reviewed-unit-listing-claims.js";
import { matchesDocumentedTechnicalIdentity } from "../technical/reviewed-catalog-model-identity.js";
import { sourceTechnicalEvidence, verifiedReconciledSourceTechnicalRule } from "./technical-source-measures-evidence.js";
export { isProductTechnicalProvenance } from "../../contracts/technical-provenance.js";

type RecoveryStep = { readonly before: SpecsMap; readonly after: SpecsMap; readonly mechanism: string;
  readonly sourceField: TechnicalRecoverySourceField | null; readonly source: DocumentedTechnicalSource | null;
  readonly editorialRuleId: string | null };
const display = (value: SpecValue): string => typeof value === "string" ? value : JSON.stringify(value);
const index = (specs: SpecsMap): ReadonlyMap<string, readonly SpecValue[]> => {
  const grouped = new Map<string, SpecValue[]>();
  for (const [field, value] of Object.entries(specs)) {
    const key = normalizeSpecKey(field);
    const values = grouped.get(key) ?? [];
    values.push(value);
    grouped.set(key, values);
  }
  return grouped;
};

const attributedSource = (
  original: ProductRecord, recoveredFrom: ProductRecord, mechanism: string, field: string, value: string,
  sourceField: RecoveryStep["sourceField"], before: SpecsMap
): { scope: "unit"; sourceField: string; sourceValue: string } |
  { scope: "unknown"; sourceField: null; sourceValue: null } => {
  if (sourceField === "longDescription" && (original.providerId === "gam" && isGamUnitUrl(original) || original.providerId === "mercaeleva") &&
    original.longDescription?.trim() && recoveredFrom.longDescription === original.longDescription) {
    return { scope: "unit", sourceField: "longDescription", sourceValue: original.longDescription };
  }
  if (sourceField && typeof sourceField === "object") {
    const originalValue = original.specs?.[sourceField.spec];
    if (typeof originalValue === "string" && originalValue.trim() &&
      (recoveredFrom.specs?.[sourceField.spec] === originalValue || before[sourceField.spec] === originalValue)) {
      return { scope: "unit", sourceField: sourceField.spec, sourceValue: originalValue };
    }
  }
  if (sourceField === "year" && original.year?.trim() === value &&
    (original.yearSource === "ficha" || original.providerId === "gomariz" && original.yearSource == null)) {
    return { scope: "unit", sourceField: "year", sourceValue: value };
  }
  if (field === normalizeSpecKey("Año de fabricación") && original.year?.trim() === value &&
    (original.yearSource === "ficha" || original.providerId === "gomariz" && original.yearSource == null) &&
    mechanism === "src/preparation/gomariz/technical/mapping/source-year-spec.ts") {
    return { scope: "unit", sourceField: "year", sourceValue: value };
  }
  if ((original.providerId === "gam" && isGamUnitUrl(original) || original.providerId === "mercaeleva") && original.longDescription?.trim() &&
    recoveredFrom.longDescription === original.longDescription &&
    (mechanism === "src/preparation/gam/technical/measurements/work-height-evidence.ts" ||
      mechanism === "src/preparation/gam/technical/measurements/measured-machine-specs.ts")) {
    return { scope: "unit", sourceField: "longDescription", sourceValue: original.longDescription };
  }
  const evidence = sourceTechnicalEvidence(original, field, value);
  if (evidence?.mechanism === mechanism && evidence.sourceValue === original.longDescription) {
    return { scope: "unit", sourceField: "longDescription", sourceValue: evidence.sourceValue };
  }
  return { scope: "unknown", sourceField: null, sourceValue: null };
};

export const captureTechnicalProvenance = (original: ProductRecord): {
  observe(before: SpecsMap, after: SpecsMap, mechanism: string, sourceField?: TechnicalRecoverySourceField,
    source?: DocumentedTechnicalSource, editorialRuleId?: string): void;
  finalize(published: SpecsMap, recoveredFrom: ProductRecord): ProductTechnicalProvenance;
} => {
  const steps: RecoveryStep[] = [];
  return {
    observe(before, after, mechanism, sourceField, source, editorialRuleId) {
      if (before !== after) steps.push({ before, after, mechanism, sourceField: sourceField ?? null,
        source: source ?? null, editorialRuleId: editorialRuleId ?? null });
    },
    finalize(published, recoveredFrom) {
      const source = index(original.specs ?? {});
      const final = index(published);
      const seen = new Set<string>();
      const entries: TechnicalSpecEvidence[] = [];
      for (const step of steps) {
        const previous = index(step.before);
        for (const [field, values] of index(step.after)) {
          if (previous.has(field) || source.has(field) || values.length !== 1 ||
            final.get(field)?.length !== 1 || seen.has(field)) continue;
          const value = display(values[0]!);
          if (display(final.get(field)![0]!) !== value) continue;
          seen.add(field);
          const documentedSource = step.source;
          const document = documentedSource?.document;
          const rule = step.editorialRuleId ?? verifiedReconciledSourceTechnicalRule(
            original, field, value, step.mechanism);
          const editorialRule = rule === null ? {} : { editorialRuleId: rule };
          const originalDescriptionEvidence = reviewedUnitDescriptionEvidence(original, field, value);
          const listingDocument = { url: original.url, brand: original.brand, model: original.model };
          const listingVerification = (step.mechanism ===
            "src/preparation/gam/technical/models/documented-multi-unit-lot-specs.ts" || step.mechanism ===
            "src/preparation/gam/technical/models/documented-electric-mobility-and-truck-access-specs.ts")
              ? reviewedUnitListingVerification(original, listingDocument, field, value) : null;
          if (originalDescriptionEvidence) {
            entries.push({ field, value, mechanism: step.mechanism, ...originalDescriptionEvidence, ...editorialRule });
          } else if (listingVerification) {
            entries.push({ field, value, mechanism: step.mechanism, scope: "unit-document",
              sourceField: null, sourceValue: null, document: listingDocument, verification: listingVerification,
              ...editorialRule });
          } else if (document && documentedSource && matchesDocumentedTechnicalIdentity(original, documentedSource)) {
            const verification = documentedSource.scope === "model-document" || documentedSource.scope === "unit-document" ||
              documentedSource.scope === "document-reference" && typeof document.model === "string"
              ? reviewedModelDocumentVerification(document, field, value) : null;
            const scope = verification && documentedSource.scope === "unit-document"
              ? "model-document" : documentedSource.scope;
            entries.push({ field, value, mechanism: step.mechanism, scope,
              sourceField: null, sourceValue: null, document,
              ...(verification === null ? {} : { verification }), ...editorialRule });
          } else {
            entries.push({ field, value, mechanism: step.mechanism,
              ...attributedSource(original, recoveredFrom, step.mechanism, field, value, step.sourceField, step.before),
              ...editorialRule });
          }
        }
      }
      return { originalRecordSha256: originalRecordFingerprint(original), entries };
    }
  };
};


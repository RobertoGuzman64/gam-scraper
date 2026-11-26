import type { ProductRecord, SpecsMap, SpecValue } from "../../contracts/catalog.js";
import { parseBatteryConfiguration, parseMeasuredLength } from "../../catalog/normalization/spec-parsers.js";
import { normalizeSpecKey } from "../../catalog/normalization/normalize-specs.js";
import { isGamUnitUrl } from "../../catalog/normalization/gam/unit-url.js";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";

import type { DocumentedTechnicalSource, ProductTechnicalProvenance, TechnicalSpecEvidence } from "../../contracts/technical-provenance.js";
import type { TechnicalRecoverySourceField } from "./technical-recovery-observation.js";
import { resolveEditorialSource } from "../editorial/core/editorial-source.js";
import { reviewedModelDocumentVerification } from "../technical/evidence/reviewed-model-claims.js";
import { reviewedUnitDescriptionEvidence } from "../technical/evidence/reviewed-unit-description-claims.js";
import { reviewedUnitListingVerification } from "../technical/evidence/reviewed-unit-listing-claims.js";
import { matchesDocumentedTechnicalIdentity } from "../technical/evidence/reviewed-catalog-model-identity.js";
import { sourceTechnicalEvidence, verifiedReconciledSourceTechnicalRule } from "./technical-source-measures-evidence.js";
export { isProductTechnicalProvenance } from "../../contracts/technical-provenance.js";

type RecoveryStep = { readonly before: SpecsMap; readonly after: SpecsMap; readonly mechanism: string;
  readonly sourceField: TechnicalRecoverySourceField | null; readonly source: DocumentedTechnicalSource | null;
  readonly editorialRuleId: string | null };
const display = (value: SpecValue): string => typeof value === "string" ? value : JSON.stringify(value);
type IndexedSpec = { readonly field: string; readonly value: SpecValue };
const index = (specs: SpecsMap): ReadonlyMap<string, readonly IndexedSpec[]> => {
  const grouped = new Map<string, IndexedSpec[]>();
  for (const [field, value] of Object.entries(specs)) {
    const key = normalizeSpecKey(field);
    const values = grouped.get(key) ?? [];
    values.push({ field, value });
    grouped.set(key, values);
  }
  return grouped;
};

export const findTechnicalSpecEvidence = (entries: readonly TechnicalSpecEvidence[], field: string, value: string): TechnicalSpecEvidence | undefined => {
  const canonical = normalizeSpecKey(field);
  const matches = entries.filter((entry) => normalizeSpecKey(entry.field) === canonical);
  return matches.length === 1 && matches[0]?.value === value ? matches[0] : undefined;
};

const observedEvidence = <T>(observed: string, canonical: string, resolve: (field: string) => T | null):
  { readonly field: string; readonly evidence: T } | null => {
  const exact = resolve(observed);
  if (exact !== null) return { field: observed, evidence: exact };
  if (observed === canonical) return null;
  const equivalent = resolve(canonical);
  return equivalent === null ? null : { field: canonical, evidence: equivalent };
};

const attributedSource = (
  original: ProductRecord, recoveredFrom: ProductRecord, mechanism: string, field: string, value: string,
  sourceField: RecoveryStep["sourceField"], before: SpecsMap
): { scope: "unit"; sourceField: string; sourceValue: string } |
  { scope: "unknown"; sourceField: null; sourceValue: null } => {
  if (sourceField === "longDescription" && (original.providerId === "gam" && isGamUnitUrl(original) || original.providerId === "mercaeleva" ||
    mechanism === "src/preparation/technical/platform-geometry-recovery.ts" && resolveEditorialSource(original) !== null) &&
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
          const observed = values[0];
          const destination = final.get(field)?.[0];
          if (!observed || !destination) continue;
          const value = display(observed.value);
          if (display(destination.value) !== value) continue;
          seen.add(field);
          const documentedSource = step.source;
          const document = documentedSource?.document;
          const rule = step.editorialRuleId ?? verifiedReconciledSourceTechnicalRule(
            original, field, value, step.mechanism);
          const editorialRule = rule === null ? {} : { editorialRuleId: rule };
          const originalDescriptionEvidence = observedEvidence(observed.field, field,
            (key) => reviewedUnitDescriptionEvidence(original, key, value));
          const listingDocument = { url: original.url, brand: original.brand, model: original.model };
          const listingVerification = (step.mechanism ===
            "src/preparation/gam/technical/models/documented-multi-unit-lot-specs.ts" || step.mechanism ===
            "src/preparation/gam/technical/models/documented-electric-mobility-and-truck-access-specs.ts")
              ? observedEvidence(observed.field, field, (key) => reviewedUnitListingVerification(original, listingDocument, key, value)) : null;
          if (originalDescriptionEvidence) {
            entries.push({ field: originalDescriptionEvidence.field, value, mechanism: step.mechanism,
              ...originalDescriptionEvidence.evidence, ...editorialRule });
          } else if (listingVerification) {
            entries.push({ field: listingVerification.field, value, mechanism: step.mechanism, scope: "unit-document",
              sourceField: null, sourceValue: null, document: listingDocument, verification: listingVerification.evidence,
              ...editorialRule });
          } else if (document && documentedSource && matchesDocumentedTechnicalIdentity(original, documentedSource)) {
            const claim = documentedSource.scope === "model-document" || documentedSource.scope === "unit-document" ||
              documentedSource.scope === "document-reference" && typeof document.model === "string"
              ? observedEvidence(observed.field, field, (key) => reviewedModelDocumentVerification(document, key, value)) : null;
            const scope = claim && documentedSource.scope === "unit-document"
              ? "model-document" : documentedSource.scope;
            entries.push({ field: claim?.field ?? field, value, mechanism: step.mechanism, scope,
              sourceField: null, sourceValue: null, document,
              ...(claim === null ? {} : { verification: claim.evidence }), ...editorialRule });
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


const recoveredVolumeFields = new Set(["Depósito de solución", "Depósito de recuperación", "Capacidad de la tolva"]);
const recoveredLitreMechanisms = new Set([
  "src/preparation/gam/technical/operations/cleaning-tank-evidence.ts",
  "src/preparation/gam/technical/operations/verified-unit-performance-specs.ts"
]);

const pairedBatteryMechanisms = new Set([
  "src/preparation/gam/technical/energy/battery-measures-evidence.ts",
  "src/preparation/gam/technical/energy/battery-electrical-evidence.ts"
]);

export const recoveredUnitAttributeSpecs = (original: ProductRecord, provenance: ProductTechnicalProvenance): SpecsMap => {
  if (provenance.originalRecordSha256 !== originalRecordFingerprint(original)) return {};
  const entries = provenance.entries.filter((entry) =>
    entry.scope === "unit" && entry.sourceField === "longDescription" && entry.sourceValue === original.longDescription &&
    (entry.field !== "Rendimiento de limpieza (m²/h)" || original.providerId === "gam" &&
      entry.mechanism === "src/preparation/gam/technical/operations/cleaning-productivity-evidence.ts") &&
    (!recoveredVolumeFields.has(entry.field) || original.providerId === "gam" && recoveredLitreMechanisms.has(entry.mechanism))
  );
  const specs: Record<string, SpecValue> = Object.fromEntries(entries.map((entry) => [entry.field, entry.value]));
  const geometryMechanism = "src/preparation/technical/platform-geometry-recovery.ts";
  const basket = entries.filter((entry) => ["Dimensiones de cesta", "Dimensiones de la cesta"].some((field) =>
    normalizeSpecKey(field) === normalizeSpecKey(entry.field)));
  if (basket.length === 1 && basket[0] && normalizeSpecKey(basket[0].field) === normalizeSpecKey("Dimensiones de cesta") && basket[0].mechanism === geometryMechanism) {
    specs["Dimensiones de la cesta"] = basket[0].value;
  } else if (basket.length === 0) {
    const lengths = entries.filter((entry) => entry.field === "Longitud de plataforma");
    const widths = entries.filter((entry) => entry.field === "Anchura de plataforma");
    const length = lengths[0];
    const width = widths[0];
    if (lengths.length === 1 && widths.length === 1 && length?.mechanism === geometryMechanism && width?.mechanism === geometryMechanism) {
      const l = parseMeasuredLength(length.value, "", "m");
      const w = parseMeasuredLength(width.value, "", "m");
      if (l !== null && w !== null && l >= 0.5 && l <= 12 && w >= 0.4 && w <= 6) {
        specs["Dimensiones de la cesta"] = `${String(l).replace(".", ",")} x ${String(w).replace(".", ",")} m`;
      }
    }
  }
  if (original.providerId !== "gam") return specs;
  const voltages = entries.filter((entry) => entry.field === "Voltaje batería (V)");
  const capacities = entries.filter((entry) => entry.field === "Capacidad de la batería (Ah)");
  const voltage = voltages[0];
  const capacity = capacities[0];
  if (voltages.length !== 1 || capacities.length !== 1 || !voltage || !capacity ||
    voltage.mechanism !== capacity.mechanism || !pairedBatteryMechanisms.has(voltage.mechanism)) return specs;
  const configuration = parseBatteryConfiguration(`${voltage.value} / ${capacity.value}`);
  return configuration === null ? specs : { ...specs, "Batería (V / Ah)": configuration };
};

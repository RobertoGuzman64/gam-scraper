import { matchesDocumentedTechnicalIdentity } from "../../preparation/shared/technical/evidence/reviewed-catalog-model-identity.js";
import type { ProductTechnicalProvenance } from "../../contracts/technical-provenance.js";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import type { ProductRecord, SpecValue } from "../../contracts/catalog.js";
import { normalizeSpecKey, normalizeSpecsObject } from "../../catalog/normalization/normalize-specs.js";
import type { PanelArtifact, PanelProviderEvidence } from "../../panel/evidence/types.js";
import { isSha } from "../../panel/evidence/evidence-files.js";
import { matchingPanelUnitKnowledge } from "../../panel/evidence/knowledge-evidence.js";
import type { PanelUnitKnowledgeEvidence } from "../../panel/evidence/knowledge-evidence.js";
import type { PanelFieldDifference, PanelFieldProvenance, PanelProductView } from "../../panel/explorer/types.js";
import { sourceYearEvidence } from "../../preparation/technical-source-year-evidence.js";
import { sourceTechnicalEvidence } from "../../preparation/technical-source-measures-evidence.js";

const display = (value: SpecValue | undefined): string | null =>
  value === undefined ? null : typeof value === "string" ? value : JSON.stringify(value);

const noAttribution = (difference: PanelFieldDifference, provider: PanelProviderEvidence): PanelFieldProvenance => ({
  field: difference.field, group: difference.group, status: "observed-only", scope: "unknown",
  publicationSha256: provider.publication.sha256,
  originalSha256: provider.original.status === "verified" ? provider.original.artifact.sha256 : null,
  sourceField: null, sourceValue: null, proof: null, sourceDigest: null, mechanism: null,
  historicalApplication: "not-demonstrated"
});

const withSource = (
  difference: PanelFieldDifference, status: PanelFieldProvenance["status"],
  sourceField: string, sourceValue: string, proof: PanelArtifact, mechanism: string | null,
  sourceDigest: string | null, provider: PanelProviderEvidence
): PanelFieldProvenance => ({
  field: difference.field, group: difference.group, status, scope: "unit", sourceField, sourceValue,
  publicationSha256: provider.publication.sha256,
  originalSha256: provider.original.status === "verified" ? provider.original.artifact.sha256 : null,
  proof, sourceDigest, mechanism, historicalApplication: "not-demonstrated"
});

const textualField: Readonly<Record<string, "title" | "short" | "general">> = {
  "Título": "title", "Descripción corta": "short", "Descripción general": "general"
};

const findTechnical = (
  original: ProductRecord, published: PanelProductView, difference: PanelFieldDifference,
  sourceArtifact: PanelArtifact, provider: PanelProviderEvidence
): PanelFieldProvenance | null => {
  const originalSpecs = original.specs ?? {};
  const publishedKeys = Object.entries(published.specs)
    .filter(([key]) => normalizeSpecKey(key) === difference.field);
  if (publishedKeys.length !== 1 || difference.after === null ||
    display(publishedKeys[0]?.[1]) !== difference.after) return null;

  const sourceKeys = Object.entries(originalSpecs).filter(([key]) => normalizeSpecKey(key) === difference.field);
  if (sourceKeys.length === 1 && difference.before !== null && difference.change !== "ambiguous") {
    const normalized = normalizeSpecsObject(originalSpecs);
    const value = normalized.normalized[difference.field];
    if (value !== undefined && value !== null && JSON.stringify(value) === JSON.stringify(publishedKeys[0]?.[1]) &&
      normalized.conflictingKeys.every((item) => item.key !== difference.field) &&
      normalized.discardedSpecs.every((item) => item.key !== difference.field)) {
      const entry = sourceKeys[0];
      if (entry && display(entry[1]) !== null) {
        return withSource(difference, "mechanism-compatible", entry[0], display(entry[1]) ?? "", sourceArtifact,
          "src/catalog/normalization/normalize-specs.ts", null, provider);
      }
    }
  }

  const yearEvidence = difference.change === "added"
    ? sourceYearEvidence(original, difference.field, difference.after) ??
      sourceTechnicalEvidence(original, difference.field, difference.after) : null;
  if (yearEvidence) {
    return withSource(difference, "source-compatible", yearEvidence.sourceField,
      yearEvidence.sourceValue, sourceArtifact, yearEvidence.mechanism, null, provider);
  }
  return null;
};

export const resolvePanelFieldProvenance = (
  original: ProductRecord | null, published: PanelProductView | null,
  differences: readonly PanelFieldDifference[], provider: PanelProviderEvidence,
  knowledge: PanelUnitKnowledgeEvidence | null, reference: string | null, sourceUrl: string,
  emitted: ProductTechnicalProvenance | null = null
): readonly PanelFieldProvenance[] => {
  if (!published) return [];
  const sourceArtifact = provider.original.status === "verified" ? provider.original.artifact : null;
  const eligible = original !== null && sourceArtifact !== null &&
    original.providerId === provider.providerId && original.reference === reference &&
    original.url === sourceUrl && isSha(provider.publication.sha256) && isSha(sourceArtifact.sha256);
  if (emitted && original && originalRecordFingerprint(original) !== emitted.originalRecordSha256) {
    throw new Error("Procedencia productiva no corresponde al original del producto");
  }
  return differences.filter((difference) => difference.change !== "unchanged").map((difference) => {
    if (!eligible || !original || !sourceArtifact || difference.group === "commercial" ||
      difference.change === "ambiguous") return noAttribution(difference, provider);
    if (difference.group === "technical") {
      if (emitted) {
        const source = emitted.entries.find((entry) => entry.field === difference.field && entry.value === difference.after);
        if (source?.scope === "unit" && !(
          source.sourceField === "year" && original.year === source.sourceValue ||
          source.sourceField === "longDescription" && original.longDescription === source.sourceValue ||
          source.sourceField !== "longDescription" && source.sourceField !== "year" &&
            original.specs?.[source.sourceField] === source.sourceValue
        )) throw new Error("La fuente de procedencia emitida no coincide con la ficha original");
        if (source && difference.change === "added" &&
          (source.scope === "model-document" || source.scope === "unit-document" ||
            source.scope === "document-reference")) {
          if (!matchesDocumentedTechnicalIdentity(original, source)) {
            throw new Error("La fuente documental emitida no corresponde al modelo original");
          }
          return { ...noAttribution(difference, provider), status: "mechanism-compatible",
            scope: source.scope, mechanism: source.mechanism, document: source.document,
            ...(source.verification ? { verification: source.verification } : {}),
            historicalApplication: "demonstrated" };
        }
        if (source && difference.change === "added" &&
          (source.scope !== "unit" || source.sourceField === "year" && original.year === source.sourceValue ||
            source.sourceField === "longDescription" && original.longDescription === source.sourceValue ||
          source.sourceField !== "longDescription" && source.sourceField !== "year" &&
            original.specs?.[source.sourceField] === source.sourceValue)) {
          return { ...withSource(difference, source.scope === "unit" ? "source-compatible" : "mechanism-compatible",
            source.sourceField ?? "", source.sourceValue ?? "", sourceArtifact,
            source.mechanism, null, provider), scope: source.scope, historicalApplication: "demonstrated" };
        }
        return noAttribution(difference, provider);
      }
      return findTechnical(original, published, difference, sourceArtifact, provider) ?? noAttribution(difference, provider);
    }
    const field = textualField[difference.field];
    if (!field || difference.after === null || difference.change === "removed") return noAttribution(difference, provider);
    const matches = matchingPanelUnitKnowledge(original, knowledge, field, difference.after);
    if (matches.length !== 1 || !knowledge) return noAttribution(difference, provider);
    const entry = matches[0];
    if (!entry) return noAttribution(difference, provider);
    return withSource(difference, "source-compatible", field, difference.after,
      knowledge.artifact, null, entry.sourceDigest, provider);
  });
};

export const queryPanelFieldProvenance = (
  provenance: readonly PanelFieldProvenance[], difference: PanelFieldDifference
): PanelFieldProvenance | null => provenance.find((entry) =>
  entry.group === difference.group && entry.field === difference.field) ?? null;

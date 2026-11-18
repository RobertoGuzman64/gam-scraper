import type { ProductRecord, SpecValue } from "../../contracts/catalog.js";
import { normalizeSpecKey, normalizeSpecsObject } from "../../catalog/normalization/normalize-specs.js";
import type { PanelArtifact, PanelProviderEvidence } from "../evidence/types.js";
import { isSha } from "../evidence/evidence-files.js";
import { matchingPanelUnitKnowledge } from "../evidence/knowledge-evidence.js";
import type { PanelUnitKnowledgeEvidence } from "../evidence/knowledge-evidence.js";
import type { PanelFieldDifference, PanelFieldProvenance, PanelProductView } from "./types.js";

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

  if (difference.change === "added" && original.yearSource === "ficha" &&
    original.year && /^(?:19|20)\d{2}$/u.test(original.year.trim()) &&
    difference.field === normalizeSpecKey("Año de fabricación") &&
    difference.after === original.year.trim() && sourceKeys.length === 0) {
    return withSource(difference, "source-compatible", "year", original.year, sourceArtifact, null, null, provider);
  }
  return null;
};

export const resolvePanelFieldProvenance = (
  original: ProductRecord | null, published: PanelProductView | null,
  differences: readonly PanelFieldDifference[], provider: PanelProviderEvidence,
  knowledge: PanelUnitKnowledgeEvidence | null, reference: string | null, sourceUrl: string
): readonly PanelFieldProvenance[] => {
  if (!published) return [];
  const sourceArtifact = provider.original.status === "verified" ? provider.original.artifact : null;
  const eligible = original !== null && sourceArtifact !== null &&
    original.providerId === provider.providerId && original.reference === reference &&
    original.url === sourceUrl && isSha(provider.publication.sha256) && isSha(sourceArtifact.sha256);
  return differences.filter((difference) => difference.change !== "unchanged").map((difference) => {
    if (!eligible || !original || !sourceArtifact || difference.group === "commercial" ||
      difference.change === "ambiguous") return noAttribution(difference, provider);
    if (difference.group === "technical") {
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

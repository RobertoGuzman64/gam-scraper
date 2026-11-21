import type { ProductRecord } from "../contracts/catalog.js";
import { matchesTechnicalDocumentVerification, matchesTechnicalUnitListingVerification, isProductTechnicalProvenance } from "../contracts/technical-provenance.js";
import type { ProductTechnicalProvenance } from "../contracts/technical-provenance.js";
import { originalRecordFingerprint } from "../catalog/identity-fingerprint.js";
import { reviewedModelDocumentVerification } from "./shared/technical/evidence/reviewed-model-claims.js";
import { reviewedUnitListingVerification } from "./shared/technical/evidence/reviewed-unit-listing-claims.js";
import { matchesDocumentedTechnicalIdentity, matchesReviewedCatalogModelIdentity } from "./shared/technical/evidence/reviewed-catalog-model-identity.js";

export const classifyPublishedTechnicalSpec = (
  original: ProductRecord, emitted: ProductTechnicalProvenance, field: string, value: string
): "own" | "reused" | "pending" => {
  if (!isProductTechnicalProvenance(emitted) ||
    originalRecordFingerprint(original) !== emitted.originalRecordSha256) return "pending";
  const source = emitted.entries.find((entry) => entry.field === field && entry.value === value);
  if (!source) return "pending";
  if (source.scope === "unit") {
    const originalValue = source.sourceField === "year" ? original.year :
      source.sourceField === "longDescription" ? original.longDescription : original.specs?.[source.sourceField];
    return originalValue === source.sourceValue ? "own" : "pending";
  }
  if (source.scope === "unknown") return "pending";
  if (source.scope === "unit-document") {
    if (source.document.url !== original.url || source.document.brand !== original.brand ||
      source.document.model !== original.model ||
      !matchesTechnicalUnitListingVerification(source.document, emitted.originalRecordSha256,
        field, value, source.verification)) return "pending";
    const reviewed = reviewedUnitListingVerification(original, source.document, field, value);
    return reviewed && reviewed.claimSha256 === source.verification?.claimSha256 ? "own" : "pending";
  }
  const reviewedIdentity = source.scope === "document-reference" &&
    matchesReviewedCatalogModelIdentity(original, source.document);
  if (!(source.scope === "model-document" || source.scope === "document-reference" &&
    source.document.model !== null && source.document.url !== original.url &&
    (source.document.brand === null || reviewedIdentity)) ||
    !matchesDocumentedTechnicalIdentity(original, source) ||
    !matchesTechnicalDocumentVerification(source.document, field, value, source.verification)) return "pending";
  const reviewed = reviewedModelDocumentVerification(source.document, field, value);
  return reviewed && reviewed.claimSha256 === source.verification?.claimSha256 ? "reused" : "pending";
};

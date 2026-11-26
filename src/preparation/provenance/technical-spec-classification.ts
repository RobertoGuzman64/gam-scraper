import type { ProductRecord } from "../../contracts/catalog.js";
import { normalizeSpecKey } from "../../catalog/normalization/normalize-specs.js";
import { buildProductIdentity } from "../../catalog/identity.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { findTechnicalSpecEvidence } from "./technical-provenance.js";
import { matchesTechnicalDocumentVerification, matchesTechnicalUnitListingVerification, isProductTechnicalProvenance } from "../../contracts/technical-provenance.js";
import type { ProductTechnicalProvenance, TechnicalSpecEvidence } from "../../contracts/technical-provenance.js";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import { reviewedModelDocumentVerification } from "../technical/evidence/reviewed-model-claims.js";
import { reviewedUnitListingVerification } from "../technical/evidence/reviewed-unit-listing-claims.js";
import { matchesDocumentedTechnicalIdentity, matchesReviewedCatalogModelIdentity } from "../technical/evidence/reviewed-catalog-model-identity.js";

type TechnicalAddition = { readonly field: string; readonly value: string };

type TechnicalEditorialCohortMember = {
  readonly providerId: string;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly original: ProductRecord | null;
  readonly emitted: ProductTechnicalProvenance | null;
  readonly originalVerified: boolean;
  readonly additions: readonly TechnicalAddition[];
};

export type TechnicalEditorialCohort = ReadonlyMap<string, ReadonlySet<string>>;

const editorialAdditionKey = (ruleId: string, field: string, value: string): string =>
  JSON.stringify([ruleId, normalizeSpecKey(field), value]);

const machineIdentity = (providerId: string, reference: string | null, sourceUrl: string): string =>
  buildProductIdentity({ providerId, reference, serialNumber: null, url: sourceUrl }).key;

const existsInOriginal = (original: ProductRecord, field: string): boolean =>
  Object.keys(original.specs ?? {}).some((key) => normalizeSpecKey(key) === normalizeSpecKey(field));

const matchesCurrentEvidence = (entries: readonly TechnicalSpecEvidence[], source: TechnicalSpecEvidence): boolean => {
  const current = findTechnicalSpecEvidence(entries, source.field, source.value);
  return current !== undefined && (!("verification" in source) || source.verification === undefined || current.field === source.field) &&
    JSON.stringify({ ...current, field: source.field }) === JSON.stringify(source);
};

export const buildPublishedTechnicalEditorialCohort = (
  members: readonly TechnicalEditorialCohortMember[]
): TechnicalEditorialCohort => {
  const groups = new Map<string, Set<string>>();
  for (const member of members) {
    const { original } = member;
    if (!member.originalVerified || original === null ||
      original.providerId !== member.providerId || original.reference !== member.reference ||
      original.url !== member.sourceUrl) continue;
    const emitted = member.emitted ?? prepareSourceProduct(original).technicalProvenance ?? null;
    if (emitted === null || !isProductTechnicalProvenance(emitted) ||
      originalRecordFingerprint(original) !== emitted.originalRecordSha256) continue;
    const entries = emitted.entries.filter((entry) => entry.editorialRuleId !== undefined &&
      member.additions.some((addition) => findTechnicalSpecEvidence(emitted.entries, addition.field, addition.value) === entry) &&
      !existsInOriginal(original, entry.field));
    if (!entries.length) continue;
    const prepared = member.emitted === null ? emitted : prepareSourceProduct(original).technicalProvenance;
    if (!prepared || !isProductTechnicalProvenance(prepared) ||
      prepared.originalRecordSha256 !== emitted.originalRecordSha256) continue;
    const identity = machineIdentity(member.providerId, member.reference, member.sourceUrl);
    for (const entry of entries) {
      if (!matchesCurrentEvidence(prepared.entries, entry)) continue;
      const editorialRuleId = entry.editorialRuleId;
      if (editorialRuleId === undefined) continue;
      const key = editorialAdditionKey(editorialRuleId, entry.field, entry.value);
      const group = groups.get(key) ?? new Set<string>();
      group.add(identity);
      groups.set(key, group);
    }
  }
  return groups;
};

export const classifyPublishedTechnicalSpec = (
  original: ProductRecord, emitted: ProductTechnicalProvenance, field: string, value: string,
  cohort?: TechnicalEditorialCohort, prepared?: ProductTechnicalProvenance
): "own" | "reused" | "pending" => {
  if (!isProductTechnicalProvenance(emitted) ||
    originalRecordFingerprint(original) !== emitted.originalRecordSha256 ||
    existsInOriginal(original, field)) return "pending";
  const source = findTechnicalSpecEvidence(emitted.entries, field, value);
  if (!source) return "pending";
  if (cohort && source.editorialRuleId !== undefined) {
    const current = prepared ?? prepareSourceProduct(original).technicalProvenance;
    if (!current || !isProductTechnicalProvenance(current) || current.originalRecordSha256 !== emitted.originalRecordSha256 ||
      !matchesCurrentEvidence(current.entries, source)) return "pending";
  }
  if (source.editorialRuleId !== undefined && cohort) {
    const group = cohort.get(editorialAdditionKey(source.editorialRuleId, field, value));
    if (!group?.has(machineIdentity(original.providerId, original.reference, original.url))) return "pending";
    return group.size > 1 ? "reused" : "own";
  }
  if (source.scope === "unit") {
    const originalValue = source.sourceField === "year" ? original.year :
      source.sourceField === "longDescription" ? original.longDescription : original.specs?.[source.sourceField];
    return originalValue === source.sourceValue ? "own" : "pending";
  }
  if (source.scope === "unknown") return "pending";
  if (cohort && source.scope !== "unit-document") return "pending";
  if (source.scope === "unit-document") {
    if (source.document.url !== original.url || source.document.brand !== original.brand ||
      source.document.model !== original.model ||
      !matchesTechnicalUnitListingVerification(source.document, emitted.originalRecordSha256,
        source.field, source.value, source.verification)) return "pending";
    const reviewed = reviewedUnitListingVerification(original, source.document, source.field, source.value);
    return reviewed && reviewed.claimSha256 === source.verification?.claimSha256 ? "own" : "pending";
  }
  const reviewedIdentity = source.scope === "document-reference" &&
    matchesReviewedCatalogModelIdentity(original, source.document);
  if (!(source.scope === "model-document" || source.scope === "document-reference" &&
    source.document.model !== null && source.document.url !== original.url &&
    (source.document.brand === null || reviewedIdentity)) ||
    !matchesDocumentedTechnicalIdentity(original, source) ||
    !matchesTechnicalDocumentVerification(source.document, source.field, source.value, source.verification)) return "pending";
  const reviewed = reviewedModelDocumentVerification(source.document, source.field, source.value);
  return reviewed && reviewed.claimSha256 === source.verification?.claimSha256 ? "reused" : "pending";
};

export const classifyPublishedTechnicalAdditions = (
  original: ProductRecord | null, emitted: ProductTechnicalProvenance | null,
  providerId: string, reference: string | null, sourceUrl: string, originalVerified: boolean,
  additions: readonly TechnicalAddition[], cohort?: TechnicalEditorialCohort
): readonly { readonly field: string; readonly value: string; readonly kind: "own" | "reused" | "pending";
  readonly linkedMachines?: readonly string[] }[] => {
  const validOriginal = originalVerified && original !== null && original.providerId === providerId &&
    original.reference === reference && original.url === sourceUrl;
  const trace = validOriginal && original !== null
    ? emitted ?? prepareSourceProduct(original).technicalProvenance ?? null : null;
  const prepared = validOriginal && original !== null && cohort &&
    trace?.entries.some((entry) => entry.editorialRuleId !== undefined)
    ? prepareSourceProduct(original).technicalProvenance : undefined;
  return additions.map(({ field, value }) => {
    const kind = validOriginal && original !== null && trace !== null
      ? classifyPublishedTechnicalSpec(original, trace, field, value, cohort, prepared) : "pending";
    const source = trace ? findTechnicalSpecEvidence(trace.entries, field, value) : undefined;
    const members = kind === "reused" && source?.editorialRuleId !== undefined
      ? cohort?.get(editorialAdditionKey(source.editorialRuleId, field, value)) : undefined;
    const ownIdentity = machineIdentity(providerId, reference, sourceUrl);
    const linkedMachines = members ? [...members].filter((id) => id !== ownIdentity).sort() : [];
    return { field, value, kind, ...(linkedMachines.length ? { linkedMachines } : {}) };
  });
};

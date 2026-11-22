import { createHash } from "node:crypto";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import type { DocumentedTechnicalSource as ProvenanceSource } from "../../../../contracts/technical-provenance.js";
import type { TechnicalRecoveryObservation } from "../../../technical-recovery-observation.js";
import { reviewedCatalogModelIdentity, matchesDocumentedTechnicalIdentity } from "./reviewed-catalog-model-identity.js";
import { reviewedModelDocumentVerification } from "./reviewed-model-claims.js";

export type DocumentedTechnicalUnit = {
  readonly fingerprint: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly categoryKey: string;
  readonly specifications: Readonly<SpecsMap>;
  readonly title?: string;
  readonly url?: string;
  readonly source?: string;
  readonly sources?: readonly string[];
  readonly fieldSources?: Readonly<Record<string, string>>;
};

export type DocumentedTechnicalSource = {
  readonly providerId: string;
  readonly isEligible: (record: ProductRecord) => boolean;
  readonly requiredCondition?: ProductRecord["condition"];
  readonly exactTitleAndUrl?: boolean;
};

export const documentedTechnicalReference = (record: ProductRecord, url: string | undefined): ProvenanceSource | undefined => {
  if (!url || !/^https:\/\/[^\s]+$/u.test(url)) return undefined;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return undefined;
  }
  const productListing = /^https:\/\/(?:online\.gamrentals\.com|sales\.mercaeleva\.com)\//u.test(url);
  const isOwnListing = url === record.url || productListing && !!record.reference &&
    (record.providerId === "gam" && pathname.split("/").some((segment) => segment.startsWith(`${record.reference}-`)) ||
      record.providerId === "mercaeleva" && pathname.endsWith(`-${record.reference}`));
  const reviewedIdentity = reviewedCatalogModelIdentity(record, url);
  if (reviewedIdentity) return { scope: "document-reference", document: reviewedIdentity };
  if (productListing && !isOwnListing) return undefined;
  const identified = !!record.brand?.trim() && !!record.model?.trim();
  return { scope: identified ? (isOwnListing ? "unit-document" : "model-document") : "document-reference",
    document: { url, brand: record.brand, model: record.model } };
};

const editorialRuleId = (
  record: ProductRecord, mechanism: string, field: string, value: string,
  source: ProvenanceSource | undefined
): string => {
  const shared = source && source.scope !== "unit-document" &&
    matchesDocumentedTechnicalIdentity(record, source)
    ? reviewedModelDocumentVerification(source.document, field, value) : null;
  const key = shared
    ? ["model", record.providerId, record.brand, record.model, record.categoryKey,
      mechanism, source?.document.url, field, value, shared.claimSha256]
    : ["unit", record.providerId, record.reference, record.url, mechanism, field, value];
  return createHash("sha256").update(JSON.stringify(key)).digest("hex");
};

const observeDocumentedTechnicalField = (
  record: ProductRecord, before: SpecsMap, field: string, value: SpecsMap[string],
  mechanism: string, source: ProvenanceSource | undefined, observe?: TechnicalRecoveryObservation
): void => {
  if (field in before) return;
  const valueText = typeof value === "string" ? value : JSON.stringify(value);
  observe?.(before, { ...before, [field]: value }, mechanism, undefined, source,
    editorialRuleId(record, mechanism, field, valueText, source));
};

export const observeDocumentedTechnicalAddition = (
  record: ProductRecord, before: SpecsMap, after: SpecsMap, url: string | undefined,
  mechanism: string, observe?: TechnicalRecoveryObservation
): void => {
  if (before === after || !observe) return;
  const source = documentedTechnicalReference(record, url);
  for (const [field, value] of Object.entries(after)) {
    observeDocumentedTechnicalField(record, before, field, value, mechanism, source, observe);
  }
};

const comparableIdentifier = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

const documentedFieldReference = (
  record: ProductRecord, field: string, sources: readonly string[]
): ProvenanceSource | undefined => {
  const prefix = field.split(/\s+·\s+/u);
  if (prefix.length === 2 && prefix[0]) {
    const identifier = comparableIdentifier(prefix[0]);
    if (identifier.length < 7) return undefined;
    const matches = sources.filter((source) => {
      try {
        const segments = new URL(source).pathname.normalize("NFD")
          .replace(/[\u0300-\u036f]/gu, "").toLowerCase().split(/[^a-z0-9]+/gu).filter(Boolean);
        for (let start = 0; start < segments.length; start++) {
          let candidate = "";
          for (let end = start; end < segments.length; end++) {
            candidate += segments[end];
            if (candidate === identifier) return true;
            if (candidate.length >= identifier.length) break;
          }
        }
        return false;
      } catch {
        return false;
      }
    });
    if (matches.length !== 1 || !/^https:\/\/[^\s]+$/u.test(matches[0]!)) return undefined;
    const url = matches[0]!;
    const direct = documentedTechnicalReference(record, url);
    if (direct) return direct;
    if (record.providerId === "gam" && /^https:\/\/online\.gamrentals\.com\//u.test(url) &&
      url !== record.url) {
      return { scope: "document-reference", document: reviewedCatalogModelIdentity(record, url) ??
        { url, brand: record.brand, model: record.model } };
    }
    return undefined;
  }
  const external = sources.filter((url) => url !== record.url);
  return sources.includes(record.url) && external.length === 1 &&
    /\bseg[uú]n cat[aá]logo t[eé]cnico\b/iu.test(field) &&
    /\.pdf(?:\?.*)?$/iu.test(external[0]!)
    ? documentedTechnicalReference(record, external[0]) : undefined;
};

export const applyDocumentedTechnicalEvidence = (
  record: ProductRecord,
  specs: SpecsMap,
  units: Readonly<Record<string, DocumentedTechnicalUnit>>,
  source: DocumentedTechnicalSource,
  observe?: TechnicalRecoveryObservation,
  mechanism?: string
): SpecsMap => {
  if (record.providerId !== source.providerId || !record.reference || !record.specs ||
    (source.requiredCondition !== undefined && record.condition !== source.requiredCondition) ||
    !source.isEligible(record)) return specs;
  const unit = units[record.reference];
  if (!unit || record.brand !== unit.brand || record.model !== unit.model ||
    record.categoryKey !== unit.categoryKey ||
    (source.exactTitleAndUrl === true && (record.title !== unit.title || record.url !== unit.url)) ||
    createHash("sha256").update(JSON.stringify(record)).digest("hex") !== unit.fingerprint ||
    Object.keys(unit.specifications).some((key) => key in specs)) return specs;
  const result = { ...specs, ...unit.specifications };
  if (mechanism) {
    if (unit.fieldSources) {
      for (const [field, value] of Object.entries(unit.specifications)) {
        observeDocumentedTechnicalAddition(record, specs, { ...specs, [field]: value },
          unit.fieldSources[field] ?? unit.source, mechanism, observe);
      }
    } else if (unit.sources && unit.sources.length > 1) {
      for (const [field, value] of Object.entries(unit.specifications)) {
        const reference = documentedFieldReference(record, field, unit.sources);
        observeDocumentedTechnicalField(record, specs, field, value, mechanism, reference, observe);
      }
    } else {
      observeDocumentedTechnicalAddition(record, specs, result,
        unit.source ?? unit.sources?.[0] ?? (source.exactTitleAndUrl ? unit.url : undefined), mechanism, observe);
    }
  }
  return result;
};

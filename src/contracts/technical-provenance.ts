import { createHash } from "node:crypto";

export type TechnicalDocumentReference = {
  readonly url: string;
  readonly brand: string | null;
  readonly model: string | null;
};

export type TechnicalDocumentVerification = {
  readonly kind: "reviewed-model-fact" | "reviewed-unit-listing";
  readonly reviewedOn: string;
  readonly support: string;
  readonly claimSha256: string;
};

export type DocumentedTechnicalSource = {
  readonly scope: "model-document" | "unit-document" | "document-reference";
  readonly document: TechnicalDocumentReference;
};

export type TechnicalSpecEvidence = {
  readonly field: string;
  readonly value: string;
  readonly mechanism: string;
  readonly editorialRuleId?: string;
} & ({
  readonly scope: "unit";
  readonly sourceField: string;
  readonly sourceValue: string;
  readonly document?: never;
} | {
  readonly scope: "unknown";
  readonly sourceField: null;
  readonly sourceValue: null;
  readonly document?: never;
} | {
  readonly scope: DocumentedTechnicalSource["scope"];
  readonly sourceField: null;
  readonly sourceValue: null;
  readonly document: TechnicalDocumentReference;
  readonly verification?: TechnicalDocumentVerification;
});

export type ProductTechnicalProvenance = {
  readonly originalRecordSha256: string;
  readonly entries: readonly TechnicalSpecEvidence[];
};

export type PublishedTechnicalProvenance = {
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly technicalProvenance: ProductTechnicalProvenance;
};

export type PublicationTechnicalProvenance = {
  readonly version: 1;
  readonly providerId: string;
  readonly preparationSha256: string;
  readonly products: readonly PublishedTechnicalProvenance[];
};

export const technicalDocumentClaimSha256 = (
  document: TechnicalDocumentReference, field: string, value: string,
  reviewedOn: string, support: string
): string => createHash("sha256").update(JSON.stringify([
  document.url, document.brand, document.model, reviewedOn, field, value, support
])).digest("hex");

export const technicalUnitListingClaimSha256 = (
  document: TechnicalDocumentReference, originalRecordSha256: string, field: string, value: string,
  reviewedOn: string, support: string
): string => createHash("sha256").update(JSON.stringify([
  document.url, document.brand, document.model, originalRecordSha256, reviewedOn, field, value, support
])).digest("hex");

export const matchesTechnicalUnitListingVerification = (
  document: unknown, originalRecordSha256: string, field: string, value: string,
  verification: unknown
): boolean => isRecord(document) && typeof document.url === "string" &&
  (document.brand === null || typeof document.brand === "string") &&
  (document.model === null || typeof document.model === "string") &&
  /^[a-f0-9]{64}$/u.test(originalRecordSha256) &&
  isDocumentVerification(verification) && verification.kind === "reviewed-unit-listing" &&
  verification.claimSha256 === technicalUnitListingClaimSha256({
    url: document.url, brand: document.brand, model: document.model
  }, originalRecordSha256, field, value, verification.reviewedOn, verification.support);

export const matchesTechnicalDocumentVerification = (
  document: unknown, field: string, value: string,
  verification: unknown
): boolean => isRecord(document) && typeof document.url === "string" &&
  (document.brand === null || typeof document.brand === "string") && typeof document.model === "string" &&
  document.model.trim().length > 0 &&
  isDocumentVerification(verification) && verification.kind === "reviewed-model-fact" &&
  verification.claimSha256 === technicalDocumentClaimSha256({ url: document.url, brand: document.brand, model: document.model },
    field, value, verification.reviewedOn, verification.support);

const isDocumentVerification = (value: unknown): value is TechnicalDocumentVerification =>
  isRecord(value) && (value.kind === "reviewed-model-fact" || value.kind === "reviewed-unit-listing") &&
  typeof value.reviewedOn === "string" && /^20\d{2}-\d{2}-\d{2}$/u.test(value.reviewedOn) &&
  typeof value.support === "string" && value.support.trim().length >= 5 &&
  typeof value.claimSha256 === "string" && /^[a-f0-9]{64}$/u.test(value.claimSha256);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const isProductTechnicalProvenance = (value: unknown): value is ProductTechnicalProvenance => {
  if (!isRecord(value)) return false;
  const item = value;
  const fingerprint = item.originalRecordSha256;
  return typeof fingerprint === "string" && /^[a-f0-9]{64}$/u.test(fingerprint) &&
    Array.isArray(item.entries) && item.entries.every((entry: unknown) => {
      if (!isRecord(entry)) return false;
      const evidence = entry;
      return typeof evidence.field === "string" && evidence.field.length > 0 &&
        typeof evidence.value === "string" && typeof evidence.mechanism === "string" &&
        evidence.mechanism.startsWith("src/preparation/") && evidence.mechanism.endsWith(".ts") &&
        (evidence.editorialRuleId === undefined || typeof evidence.editorialRuleId === "string" &&
          /^[a-f0-9]{64}$/u.test(evidence.editorialRuleId)) &&
        (evidence.scope === "unit" && typeof evidence.sourceField === "string" &&
          evidence.sourceField.trim().length > 0 && typeof evidence.sourceValue === "string" && evidence.sourceValue.length > 0 && evidence.document === undefined && evidence.verification === undefined ||
          evidence.scope === "unknown" && evidence.sourceField === null && evidence.sourceValue === null &&
            evidence.document === undefined && evidence.verification === undefined ||
          (evidence.scope === "model-document" || evidence.scope === "unit-document" ||
            evidence.scope === "document-reference") &&
            evidence.sourceField === null && evidence.sourceValue === null &&
            isRecord(evidence.document) && typeof evidence.document.url === "string" &&
            /^https:\/\/[^\s]+$/u.test(evidence.document.url) &&
            (evidence.document.brand === null || typeof evidence.document.brand === "string" &&
              evidence.document.brand.trim().length > 0) &&
            (evidence.document.model === null || typeof evidence.document.model === "string" &&
              evidence.document.model.trim().length > 0) &&
            (evidence.scope === "document-reference" ||
              typeof evidence.document.brand === "string" && typeof evidence.document.model === "string" ||
              evidence.scope === "unit-document" && evidence.verification !== undefined &&
                matchesTechnicalUnitListingVerification(evidence.document, fingerprint,
                  evidence.field, evidence.value, evidence.verification)) &&
            (evidence.verification === undefined ||
              (evidence.scope === "unit-document"
                ? matchesTechnicalUnitListingVerification(evidence.document, fingerprint,
                    evidence.field, evidence.value, evidence.verification)
                : matchesTechnicalDocumentVerification(
                    evidence.document, evidence.field, evidence.value, evidence.verification))));
    }) && new Set(item.entries.map((entry: unknown) => isRecord(entry) ? entry.field : null)).size === item.entries.length;
};

const identity = (reference: string | null, sourceUrl: string): string =>
  JSON.stringify([reference, sourceUrl]);

export const isPublicationTechnicalProvenance = (value: unknown): value is PublicationTechnicalProvenance => {
  if (!isRecord(value) || value.version !== 1 || typeof value.providerId !== "string" ||
    !/^[a-z0-9_-]+$/u.test(value.providerId) || typeof value.preparationSha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.preparationSha256) || !Array.isArray(value.products)) return false;
  const keys = new Set<string>();
  for (const entry of value.products) {
    if (!isRecord(entry) || (entry.reference !== null && typeof entry.reference !== "string") ||
      typeof entry.sourceUrl !== "string" || !entry.sourceUrl ||
      !isProductTechnicalProvenance(entry.technicalProvenance)) return false;
    const key = identity(entry.reference, entry.sourceUrl);
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return true;
};

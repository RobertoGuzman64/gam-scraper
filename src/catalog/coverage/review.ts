import type { CanonicalCatalog } from "../canonical-catalog.js";
import { compareCanonicalCoverage } from "./compare.js";
import { auditChangedProduct, changedFieldChecks } from "./change-audit.js";
import { hasGamGalleryCorrection } from "../editorial/providers/gam/verified-gallery.js";
import { hasGamShortDescriptionCorrection } from "../editorial/providers/gam/verified-description.js";
import type { ChangedFieldCheck, ChangedProductAudit } from "./change-audit.js";

export type CoverageReview = {
  readonly version: 1;
  readonly baselineSha256: string;
  readonly currentSha256: string;
  readonly missing: readonly {
    readonly reference: string;
    readonly url: string;
    readonly decision: "retirado" | "ausencia_listado_acreditada" | "no_acreditado" | null;
    readonly reason: string | null;
    readonly evidenceUrls: readonly string[];
  }[];
  readonly changed: readonly {
    readonly reference: string;
    readonly url: string;
    readonly fields: readonly string[];
    readonly decision: "aceptado" | "rechazado" | null;
    readonly audit: ChangedProductAudit;
    readonly fieldChecks: readonly ChangedFieldCheck[];
    readonly reason: string | null;
    readonly evidenceUrls: readonly string[];
  }[];
};

export const createCoverageReview = (
  baseline: CanonicalCatalog,
  current: CanonicalCatalog,
  baselineSha256: string,
  currentSha256: string
): CoverageReview => {
  const changes = compareCanonicalCoverage(baseline, current);
  const missing = changes.missing.map((product) => {
    if (!product.reference) throw new Error("Ausencia sin referencia para revisión editorial");
    return { reference: product.reference, url: product.url, decision: null, reason: null, evidenceUrls: [] };
  });
  const previousByReference = new Map(baseline.products.map((product) => [product.reference, product]));
  const currentByReference = new Map(current.products.map((product) => [product.reference, product]));
  const changed = changes.changedDetails.map((product) => {
    if (!product.reference) throw new Error("Cambio sin referencia para revisión editorial");
    const before = previousByReference.get(product.reference);
    const after = currentByReference.get(product.reference);
    if (!before || !after) throw new Error(`Cambio sin pareja de productos: ${product.reference}`);
    return {
      reference: product.reference, url: product.url, fields: product.fields,
      audit: auditChangedProduct(before, after, product.fields),
      fieldChecks: changedFieldChecks(product.fields),
      decision: null, reason: null, evidenceUrls: []
    };
  });
  return { version: 1, baselineSha256, currentSha256, missing, changed };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validEvidence = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.length > 0 && value.every((url: unknown) => {
    if (typeof url !== "string") return false;
    try { return new URL(url).protocol === "https:"; } catch { return false; }
  });

const isSourceListingEvidence = (url: string, originalUrl: string): boolean => {
  try {
    const listing = new URL(url);
    const product = new URL(originalUrl);
    const listingParts = listing.pathname.split("/").filter(Boolean);
    const productParts = product.pathname.split("/").filter(Boolean);
    return listing.origin === product.origin &&
      listingParts.length === 2 && productParts.length === 3 &&
      listingParts[0] === productParts[0] && /^\d+-/.test(listingParts[1] ?? "");
  } catch {
    return false;
  }
};

const verifiedGamCatalogSha256 = "7f31ebee51f573401d6f20bbe850751c46ff1659a5a91ffcf4302e82ed11e11d";
const excludedGamChangeReferences = new Set(["6002", "6003", "6004"]);

const validFieldChecks = (
  value: unknown,
  required: readonly ChangedFieldCheck[],
  reference: string,
  hasVerifiedGamCorrections: boolean,
  excluded: boolean
): boolean => {
  if (!Array.isArray(value) || value.length !== required.length) return false;
  const checked = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.field !== "string" || checked.has(entry.field) ||
      !required.some((item) => item.field === entry.field) ||
      !(excluded ? entry.decision === "rechazado" :
        entry.decision === "aceptado" ||
        (hasVerifiedGamCorrections && entry.decision === "corregido" && (
          (entry.field === "images" && hasGamGalleryCorrection(reference)) ||
          (entry.field === "shortDescription" && hasGamShortDescriptionCorrection(reference))
        ))) ||
      typeof entry.reason !== "string" || entry.reason.trim().length < 15 ||
      !validEvidence(entry.evidenceUrls)) return false;
    checked.add(entry.field);
  }
  return checked.size === required.length;
};

const isReviewed = (
  value: unknown,
  kind: "missing" | "changed",
  originalUrl: string,
  requiredChecks: readonly ChangedFieldCheck[] = [],
  reference = "",
  hasVerifiedGamCorrections = false
): boolean => {
  if (!isRecord(value) || typeof value.reason !== "string" || value.reason.trim().length < 15 ||
    !validEvidence(value.evidenceUrls)) return false;
  if (kind === "changed") {
    const excluded = hasVerifiedGamCorrections && excludedGamChangeReferences.has(reference) && value.decision === "rechazado";
    return (value.decision === "aceptado" || excluded) &&
      validFieldChecks(value.fieldChecks, requiredChecks, reference, hasVerifiedGamCorrections, excluded);
  }
  if (value.decision === "retirado") return true;
  return value.decision === "ausencia_listado_acreditada" &&
    value.evidenceUrls.some((url) => isSourceListingEvidence(url, originalUrl));
};

export const verifyCoverageReview = (
  value: unknown,
  expected: CoverageReview
): void => {
  if (!isRecord(value) || value.version !== 1 ||
    value.baselineSha256 !== expected.baselineSha256 ||
    value.currentSha256 !== expected.currentSha256 ||
    !Array.isArray(value.missing) || !Array.isArray(value.changed) ||
    value.missing.length !== expected.missing.length ||
    value.changed.length !== expected.changed.length) {
    throw new Error("Revisión de cobertura ausente, caducada o incompleta");
  }
  for (const [kind, required] of [
    ["missing", expected.missing], ["changed", expected.changed]
  ] as const) {
    const entries: unknown = value[kind];
    if (!Array.isArray(entries)) throw new Error("Bloque de cobertura inválido");
    const actual: readonly unknown[] = entries;
    const byReference = new Map<string, unknown>();
    for (const entry of actual) {
      if (!isRecord(entry) || typeof entry.reference !== "string" || byReference.has(entry.reference)) {
        throw new Error(`Revisión ${kind} con referencias inválidas o duplicadas`);
      }
      byReference.set(entry.reference, entry);
    }
    for (const item of required) {
      const entry = byReference.get(item.reference);
      if (!isRecord(entry) || entry.url !== item.url ||
        (kind === "changed" && (
          !Array.isArray(entry.fields) || JSON.stringify(entry.fields) !== JSON.stringify("fields" in item ? item.fields : []) ||
          JSON.stringify(entry.audit) !== JSON.stringify("audit" in item ? item.audit : null)
        )) || !isReviewed(entry, kind, item.url, "fieldChecks" in item ? item.fieldChecks : [],
          item.reference, expected.currentSha256 === verifiedGamCatalogSha256)) {
        throw new Error(`Revisión de cobertura pendiente o incoherente: ${kind}:${item.reference}`);
      }
    }
  }
};

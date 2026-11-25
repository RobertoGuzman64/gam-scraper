import type { ProductRecord, SpecsMap, SpecValue } from "../../contracts/catalog.js";
import type { ProductTechnicalProvenance } from "../../contracts/technical-provenance.js";
import type { PreparedProduct } from "../../preparation/contracts.js";
import { resolveConsistentEditorialFamily, type EditorialFamily } from "../../preparation/editorial/core/editorial-families.js";
import { resolveEditorialSource } from "../../preparation/editorial/core/editorial-source.js";
import { buildProductIdentity } from "../identity.js";
import { originalRecordFingerprint } from "../identity-fingerprint.js";
import { normalizeSpecKey, normalizeSpecsObject, type DiscardReason, type NormalizedSpecValue } from "../normalization/normalize-specs.js";
import { SPEC_RULES, type SpecRuleType } from "../normalization/spec-rules.js";

export type NormalizationAuditStage = "original" | "preparacion" | "publicacion";

export type NormalizationAssessment = "observacion_acreditada" | "hipotesis" | "diferencia_legitima" | "no_evaluable";

export type NormalizationSpecObservation = {
  readonly rawKey: string;
  readonly rawValue: SpecValue;
  readonly canonicalKey: string;
} & ({
  readonly kind: "interpretada";
  readonly assessment: "observacion_acreditada";
  readonly rule: SpecRuleType;
  readonly normalizedValue: NonNullable<NormalizedSpecValue>;
} | {
  readonly kind: "descartada";
  readonly assessment: Extract<NormalizationAssessment, "hipotesis" | "no_evaluable">;
  readonly rule: SpecRuleType;
  readonly reasons: readonly DiscardReason[];
} | {
  readonly kind: "no_reconocida";
  readonly assessment: "no_evaluable";
  readonly rule: null;
});

export type NormalizationStageObservation = {
  readonly stage: NormalizationAuditStage;
  readonly specifications: readonly NormalizationSpecObservation[];
};

export type NormalizationProductObservation = {
  readonly identity: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly family: EditorialFamily | null;
  readonly sourceCategoryKey: string;
  readonly originalRecordSha256: string;
  readonly preparationStatus: PreparedProduct["status"];
  readonly technicalProvenance: ProductTechnicalProvenance | null;
  readonly original: NormalizationStageObservation;
  readonly prepared: NormalizationStageObservation;
  readonly publication?: { readonly sha256: string; readonly observation: NormalizationStageObservation };
};

export const inspectNormalizationStage = (
  stage: NormalizationAuditStage, specs: SpecsMap
): NormalizationStageObservation => {
  const result = normalizeSpecsObject(specs);
  const unknown = new Set(result.unknownKeys);
  const discarded = new Map<string, DiscardReason[]>();
  for (const { rawKey, reason } of result.discardedSpecs) {
    const reasons = discarded.get(rawKey) ?? [];
    if (!reasons.includes(reason)) reasons.push(reason);
    discarded.set(rawKey, reasons);
  }
  const specifications = Object.entries(specs).map(([rawKey, rawValue]): NormalizationSpecObservation => {
    const canonicalKey = normalizeSpecKey(rawKey);
    const field = { rawKey, rawValue, canonicalKey };
    if (unknown.has(canonicalKey)) return { ...field, kind: "no_reconocida", assessment: "no_evaluable", rule: null };
    const rule = Object.hasOwn(SPEC_RULES, canonicalKey) ? SPEC_RULES[canonicalKey] : undefined;
    if (!rule) throw new Error(`Diagnóstico de normalización sin regla: ${canonicalKey}`);
    const reasons = discarded.get(rawKey);
    if (reasons) return { ...field, kind: "descartada", rule, reasons,
      assessment: reasons.every((reason) => reason === "null_like") ? "no_evaluable" : "hipotesis" };
    const normalizedValue = result.normalized[canonicalKey];
    if (normalizedValue === undefined || normalizedValue === null) {
      throw new Error(`Diagnóstico de normalización sin resultado: ${canonicalKey}`);
    }
    return { ...field, kind: "interpretada", assessment: "observacion_acreditada", rule, normalizedValue };
  });
  return { stage, specifications };
};

export const inspectNormalizationProduct = (
  source: ProductRecord, prepared: PreparedProduct
): NormalizationProductObservation => {
  const identity = buildProductIdentity(source).key;
  const originalRecordSha256 = originalRecordFingerprint(source);
  const technicalProvenance = prepared.technicalProvenance ?? null;
  if (prepared.product.providerId !== source.providerId || prepared.product.sourceUrl !== source.url ||
    technicalProvenance !== null && technicalProvenance.originalRecordSha256 !== originalRecordSha256) {
    throw new Error(`Preparación no conciliada con el origen de normalización: ${identity}`);
  }
  const editorialSource = resolveEditorialSource(source);
  const additionalTitle = source.specs?.["Título adicional"];
  const family = editorialSource ? resolveConsistentEditorialFamily(editorialSource.familyClues, source.title,
    typeof additionalTitle === "string" ? additionalTitle : null, `${source.subcategory ?? ""} | ${source.categoryName}`) : null;
  return {
    identity, providerId: source.providerId, reference: source.reference, sourceUrl: source.url,
    family, sourceCategoryKey: source.categoryKey,
    originalRecordSha256, preparationStatus: prepared.status, technicalProvenance,
    original: inspectNormalizationStage("original", source.specs ?? {}),
    prepared: inspectNormalizationStage("preparacion", prepared.product.spec)
  };
};

export const attachNormalizationPublication = (
  product: NormalizationProductObservation, accreditedSource: ProductRecord,
  published: PreparedProduct["product"], publicationSha256: string
): NormalizationProductObservation => {
  if (product.publication !== undefined) throw new Error(`Publicación duplicada en normalización: ${product.identity}`);
  if (!/^[a-f0-9]{64}$/u.test(publicationSha256) ||
    product.identity !== buildProductIdentity(accreditedSource).key ||
    product.originalRecordSha256 !== originalRecordFingerprint(accreditedSource) ||
    product.providerId !== accreditedSource.providerId || product.reference !== accreditedSource.reference ||
    product.sourceUrl !== accreditedSource.url || published.providerId !== product.providerId ||
    published.reference !== product.reference || published.sourceUrl !== product.sourceUrl) {
    throw new Error(`Publicación no conciliada con el original de normalización: ${product.identity}`);
  }
  return { ...product, publication: { sha256: publicationSha256,
    observation: inspectNormalizationStage("publicacion", published.spec) } };
};

export const attachNormalizationPublications = (
  products: readonly NormalizationProductObservation[], accreditedSources: ReadonlyMap<string, ProductRecord>,
  providerId: string, published: readonly PreparedProduct["product"][], publicationSha256: string
): readonly NormalizationProductObservation[] => {
  if (!/^[a-f0-9]{64}$/u.test(publicationSha256)) throw new Error(`Huella de publicación inválida: ${providerId}`);
  const byUrl = new Map<string, NormalizationProductObservation>();
  const identities = new Set<string>();
  for (const product of products) {
    if (product.providerId !== providerId || byUrl.has(product.sourceUrl) || identities.has(product.identity) ||
      product.publication !== undefined) throw new Error(`Población de normalización incoherente: ${product.identity}`);
    byUrl.set(product.sourceUrl, product);
    identities.add(product.identity);
  }
  const attached = new Map<string, NormalizationProductObservation>();
  for (const candidate of published) {
    const product = byUrl.get(candidate.sourceUrl);
    const source = product ? accreditedSources.get(product.identity) : undefined;
    if (!product || !source || attached.has(product.identity)) {
      throw new Error(`Publicación sin origen único en normalización: ${candidate.providerId}:${candidate.reference ?? candidate.sourceUrl}`);
    }
    attached.set(product.identity, attachNormalizationPublication(product, source, candidate, publicationSha256));
  }
  return products.map((product) => attached.get(product.identity) ?? product);
};

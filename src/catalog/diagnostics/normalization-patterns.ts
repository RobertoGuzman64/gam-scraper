import type { SpecScalar, SpecValue } from "../../contracts/catalog.js";
import { fold } from "../../preparation/classification/category-utils.js";
import { normalizeTechnicalPresentation } from "../../preparation/technical/technical-presentation.js";
import type { NormalizedSpecValue } from "../normalization/normalize-specs.js";
import type { SpecRuleType } from "../normalization/spec-rules.js";
import type { NormalizationAssessment, NormalizationAuditStage, NormalizationProductObservation,
  NormalizationSpecObservation } from "./normalization-audit.js";

export type NormalizationPatternKind = "alias" | "unidad" | "formato_numerico" | "valor_categorico" | "rechazo" | "clave_no_reconocida";

export type NormalizationPatternScope = {
  readonly family: NonNullable<NormalizationProductObservation["family"]>;
  readonly providerId: null;
  readonly sourceCategoryKey: null;
} | {
  readonly family: null;
  readonly providerId: string;
  readonly sourceCategoryKey: string;
};

export type NormalizationPatternOccurrence = Pick<NormalizationProductObservation,
  "identity" | "providerId" | "reference" | "sourceUrl" | "originalRecordSha256"> & {
  readonly specification: NormalizationSpecObservation;
};

export type NormalizationPattern = {
  readonly kind: NormalizationPatternKind;
  readonly scope: NormalizationPatternScope;
  readonly stage: NormalizationAuditStage;
  readonly key: string;
  readonly rule: SpecRuleType | null;
  readonly signature: string | null;
  readonly assessment: NormalizationAssessment;
  readonly matchingResults: readonly { readonly signature: string; readonly variants: readonly string[] }[];
  readonly variants: readonly {
    readonly signature: string;
    readonly occurrences: readonly NormalizationPatternOccurrence[];
  }[];
};

type PatternDescriptor = Pick<NormalizationPattern, "kind" | "scope" | "stage" | "key" | "rule" | "signature">;
type Variant = { signature: string; occurrences: NormalizationPatternOccurrence[] };
type Bucket = { descriptor: PatternDescriptor; variants: Map<string, Variant>; results: Map<string, Set<string>> };

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const encode = (value: unknown): string => JSON.stringify(value);
const scopeOf = (product: NormalizationProductObservation): NormalizationPatternScope => product.family === null
  ? { family: null, providerId: product.providerId, sourceCategoryKey: product.sourceCategoryKey }
  : { family: product.family, providerId: null, sourceCategoryKey: null };

const numericRules: ReadonlySet<SpecRuleType> = new Set(["number", "number_array", "dimension", "dimension_rect"]);
const unitTokens = /[\p{L}%]+(?:[²³23])?(?:\/[\p{L}%]+(?:[²³23])?)*/gu;
const numericShape = (text: string): string => text.replace(/\d+(?:[.,]\d+)*/gu,
  (literal) => literal.replace(/\d+/gu, (digits, offset: number) => offset === 0 ? "#" : "#".repeat(digits.length)));
const describeValue = (value: SpecValue, describe: (entry: SpecScalar) => unknown): unknown =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? ["escalar", describe(value)] : ["lista", value.map(describe)];
const isDimension = (rule: SpecRuleType | null): boolean => rule === "dimension" || rule === "dimension_rect";
const unitText = (text: string, rule: SpecRuleType | null): readonly string[] =>
  (isDimension(rule) ? text.split(/[x×]/iu) : [text]).flatMap((part) => part.match(unitTokens) ?? []);
const unitsOf = (specification: NormalizationSpecObservation): string => {
  const value = specification.rawValue;
  const entries = typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? [value] : value;
  return encode([specification.rawKey.match(/\(([^)]+)\)\s*$/u)?.[1] ?? null,
    entries.flatMap((entry) => typeof entry === "string" ? unitText(entry, specification.rule) : [])]);
};
const formatOf = (specification: NormalizationSpecObservation): string => encode(describeValue(specification.rawValue, (entry) => {
  if (typeof entry !== "string") return [typeof entry];
  const parts = isDimension(specification.rule) ? entry.split(/([x×])/iu) : [entry];
  return ["texto", parts.map((part) => isDimension(specification.rule) && /^[x×]$/iu.test(part) ? part :
    numericShape(part.replace(unitTokens, "U"))).join("")];
}));
const rejectionShape = (value: SpecValue): string => encode(describeValue(value, (entry) => typeof entry === "string"
  ? ["texto", numericShape(fold(entry))] : [typeof entry]));

const normalizedShape = (value: NonNullable<NormalizedSpecValue>): string => encode(
  Array.isArray(value) ? ["lista", value.length] :
    typeof value === "object" && "largo" in value && "ancho" in value
      ? ["ejes", value.largo !== null, value.ancho !== null, "grosor" in value && value.grosor !== null]
      : typeof value);

const categoricalResult = (specification: Extract<NormalizationSpecObservation, { kind: "interpretada" }>): string | boolean | null => {
  if (specification.rule === "bool" && typeof specification.normalizedValue === "boolean") return specification.normalizedValue;
  if (specification.rule !== "enum" || typeof specification.normalizedValue !== "string") return null;
  const key = specification.rawKey;
  const presented = normalizeTechnicalPresentation({ [key]: specification.normalizedValue })[key];
  return typeof presented === "string" && presented.trim() ? presented : null;
};

const add = (buckets: Map<string, Bucket>, descriptor: PatternDescriptor, signature: string,
  occurrence: NormalizationPatternOccurrence, result?: string): void => {
  const id = encode(descriptor);
  let bucket = buckets.get(id);
  if (!bucket) {
    bucket = { descriptor, variants: new Map(), results: new Map() };
    buckets.set(id, bucket);
  }
  let variant = bucket.variants.get(signature);
  if (!variant) {
    variant = { signature, occurrences: [] };
    bucket.variants.set(signature, variant);
  }
  variant.occurrences.push(occurrence);
  if (result !== undefined) {
    const variants = bucket.results.get(result) ?? new Set<string>();
    variants.add(signature);
    bucket.results.set(result, variants);
  }
};

const assessmentOf = (bucket: Bucket): NormalizationAssessment | null => {
  const { kind } = bucket.descriptor;
  if (kind === "rechazo") return "hipotesis";
  if (kind === "clave_no_reconocida") {
    const hasUnknown = [...bucket.variants.values()].some(({ occurrences }) =>
      occurrences.some(({ specification }) => specification.kind === "no_reconocida"));
    if (!hasUnknown) return null;
    return bucket.variants.size > 1 ? "hipotesis" : "no_evaluable";
  }
  if (bucket.variants.size < 2) return null;
  if (kind !== "alias" && ![...bucket.results.values()].some((variants) => variants.size === bucket.variants.size)) {
    return "hipotesis";
  }
  return "observacion_acreditada";
};

export const discoverNormalizationPatterns = (products: readonly NormalizationProductObservation[]): readonly NormalizationPattern[] => {
  const buckets = new Map<string, Bucket>();
  const identities = new Set<string>();
  for (const product of products) {
    if (identities.has(product.identity)) throw new Error(`Identidad duplicada en patrones de normalización: ${product.identity}`);
    identities.add(product.identity);
    const { identity, providerId, reference, sourceUrl, originalRecordSha256 } = product;
    const scope = scopeOf(product);
    const stages = [product.original, product.prepared, ...(product.publication ? [product.publication.observation] : [])];
    for (const { stage, specifications } of stages) {
      for (const specification of specifications) {
        const occurrence = { identity, providerId, reference, sourceUrl, originalRecordSha256, specification };
        const { rawKey, rawValue, canonicalKey, rule } = specification;
        const base = { scope, stage, key: canonicalKey, rule };
        add(buckets, { kind: "clave_no_reconocida", ...base, key: fold(rawKey), rule: null, signature: null }, rawKey, occurrence);
        if (specification.kind === "no_reconocida") continue;
        if (specification.kind === "descartada") {
          if (specification.assessment === "hipotesis") {
            const signature = encode([[...specification.reasons].sort(compare), rejectionShape(rawValue)]);
            add(buckets, { kind: "rechazo", ...base, signature }, rawKey, occurrence);
          }
          continue;
        }
        add(buckets, { kind: "alias", ...base, signature: null }, rawKey, occurrence);
        if (numericRules.has(specification.rule)) {
          const signature = normalizedShape(specification.normalizedValue);
          const result = encode(specification.normalizedValue);
          add(buckets, { kind: "unidad", ...base, signature }, unitsOf(specification), occurrence, result);
          add(buckets, { kind: "formato_numerico", ...base, signature }, formatOf(specification), occurrence, result);
        }
        const categorical = categoricalResult(specification);
        if (categorical !== null) {
          const signature = encode(typeof categorical === "string" ? fold(categorical) : categorical);
          add(buckets, { kind: "valor_categorico", ...base, signature }, encode(rawValue), occurrence, encode(categorical));
        }
      }
    }
  }
  const patterns: NormalizationPattern[] = [];
  for (const [, bucket] of [...buckets].sort(([a], [b]) => compare(a, b))) {
    const assessment = assessmentOf(bucket);
    if (assessment === null) continue;
    const variants = [...bucket.variants.values()].sort((a, b) => compare(a.signature, b.signature))
      .map(({ signature, occurrences }) => ({ signature, occurrences: occurrences.sort((a, b) =>
        compare(a.identity, b.identity) || compare(a.specification.rawKey, b.specification.rawKey)) }));
    const matchingResults = [...bucket.results].filter(([, signatures]) => signatures.size > 1)
      .sort(([a], [b]) => compare(a, b)).map(([signature, signatures]) => ({ signature, variants: [...signatures].sort(compare) }));
    patterns.push({ ...bucket.descriptor, assessment, variants, matchingResults });
  }
  return patterns;
};

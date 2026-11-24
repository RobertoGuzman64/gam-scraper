import { createHash } from "node:crypto";
import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";
import type { DocumentedTechnicalSource as ProvenanceSource } from "../../contracts/technical-provenance.js";
import type { TechnicalRecoveryObservation } from "../provenance/technical-recovery-observation.js";
import { reviewedCatalogModelIdentity, matchesDocumentedTechnicalIdentity } from "./reviewed-catalog-model-identity.js";
import { reusableReviewedModelClaims, reviewedModelDocumentVerification } from "./reviewed-model-claims.js";

import { resolveEditorialFacts } from "../editorial/core/editorial-facts.js";
import type { EditorialEnergy } from "../editorial/core/editorial-facts.js";
import { editorialMetricOf, editorialQuantityOf } from "../editorial/measurements/editorial-measurements.js";
import { fold } from "../classification/category-utils.js";

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

const geometryAliases: Readonly<Record<string, RegExp>> = {
  "Altura de plataforma": /^altura (?:maxima )?(?:de (?:la )?)?plataforma(?: (?:maxima|max\.?))?(?: \(m[m]?\))?$/u,
  "Longitud de plataforma": /^(?:longitud|largo) (?:de (?:la )?)?(?:plataforma|cesta)(?: principal)?(?: \(m[m]?\))?$/u,
  "Anchura de plataforma": /^(?:anchura|ancho) (?:de (?:la )?)?(?:plataforma|cesta)(?: principal)?(?: \(m[m]?\))?$/u,
  "Extensión de plataforma": /^(?:extension(?: de (?:la )?plataforma)?|longitud (?:de )?extension|plataforma extensible)(?: \(m[m]?\))?$/u
};

const combinedGeometry = /^(?:dimensiones|medidas) (?:de (?:la )?)?(?:cesta|plataforma)\b/u;
const explicitGeometry = /\b(?:altura|longitud|anchura|ancho|largo|dimensiones|medidas|extension) (?:de (?:la )?)?(?:plataforma|cesta)\b[^.!?;\n]{0,50}\d|\b(?:plataforma extensible|longitud (?:de )?extension)\b[^.!?;\n]{0,50}\d/u;

const geometryConfigurationConflict = /\b(?:sin|carece de|no (?:dispone|cuenta) de) (?:una? |la )?(?:extension|plataforma|cesta)\b|\b(?:extension|plataforma|cesta)\b[^.!?;]{0,40}\b(?:opcional|no instalada|no incluida|modificada|sustituida)\b/u;

const nominalLoadCenter = /\b(?:centro (?:nominal )?(?:de gravedad )?(?:de (?:la )?)?carga|baricentro (?:de (?:la )?)?carga|load cent(?:er|re))\b/u;
const handlingCapacityKeys = /^(?:capacidad(?: nominal)?(?: de carga)?|capacidad maxima de elevacion)(?: \(kg\))?$/u;
const energyPattern = /\b(?:glp|lpg|diesel|gasoil|gasolina|electric[oa]s?|bateria)\b/gu;
const energyIdentifier = (value: string): EditorialEnergy => /^(?:glp|lpg)$/u.test(value) ? "GLP" :
  /^(?:diesel|gasoil)$/u.test(value) ? "diésel" : value === "gasolina" ? "gasolina" : "eléctrica";

export const recoverReviewedModelTechnicalSpecs = (
  original: ProductRecord, specs: SpecsMap, observe?: TechnicalRecoveryObservation
): SpecsMap => {
  if (!original.brand || !original.model || !original.specs) return specs;
  const claims = reusableReviewedModelClaims(original.brand, original.model);
  if (claims.length !== 1) return specs;
  const claim = claims[0];
  if (!claim) return specs;
  const facts = resolveEditorialFacts(original);
  const expected = claim.compatibility;
  if (!facts || facts.brand !== original.brand || facts.model !== original.model ||
    facts.family !== expected.family) return specs;
  const sourceText = fold([original.title, original.shortDescription, original.longDescription].filter(Boolean).join(" "));
  const escapedModel = fold(original.model).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  if (new RegExp(`\\b${escapedModel}[-/][a-z0-9]+`, "u").test(sourceText)) return specs;
  if (expected.family === "carretilla-elevadora") {
    if (facts.loadCapacityKg !== expected.loadCapacityKg || !original.country ||
      fold(original.country) !== fold(expected.marketCountry) || !original.year || !/^\d{4}$/u.test(original.year) ||
      Number(original.year) < expected.firstYear || expected.lastYear !== undefined && Number(original.year) > expected.lastYear ||
      facts.energy !== null && facts.energy !== expected.energy || nominalLoadCenter.test(sourceText)) return specs;
    const energyEvidence = fold([original.title, original.shortDescription, original.longDescription,
      ...Object.entries(original.specs).filter(([key]) => /^(?:motor|tipo (?:de )?motor|motorizacion|energia|combustible)$/u.test(fold(key)))
        .map(([, value]) => String(value))].filter(Boolean).join(" "));
    if (/\b(?:sin|no (?:es|usa|utiliza|funciona con)|convertid[oa] a)\s+(?:motor (?:de )?)?(?:glp|lpg|diesel|gasoil|gasolina|electric[oa]s?|bateria)\b/u.test(energyEvidence)) return specs;
    const energies = new Set([...energyEvidence.matchAll(energyPattern)].map((match) => energyIdentifier(match[0])));
    if (energies.size !== 1 || !expected.energy || !energies.has(expected.energy)) return specs;
    if ([original.specs, specs].some((source) => Object.entries(source).some(([key, value]) =>
      nominalLoadCenter.test(fold(key)) || handlingCapacityKeys.test(fold(key)) &&
        editorialQuantityOf(source, [key], "kg") !== expected.loadCapacityKg ||
      nominalLoadCenter.test(fold(String(value)))))) return specs;
    if (claim.facts.length !== 1 || claim.facts[0]?.field !== "Centro de carga nominal del modelo" ||
      editorialQuantityOf({ [claim.facts[0].field]: claim.facts[0].value }, [claim.facts[0].field], "mm") === null) return specs;
    const fact = claim.facts[0];
    const result = { ...specs, [fact.field]: fact.value };
    observeDocumentedTechnicalAddition(original, specs, result, claim.url,
      "src/preparation/technical/documented-technical-evidence.ts", observe);
    return result;
  }
  if (facts.energy !== expected.energy || facts.workingHeightM !== expected.workingHeightM ||
    facts.lengthM !== expected.lengthM || facts.widthM !== expected.widthM) return specs;
  const capacity = editorialQuantityOf(original.specs, ["Capacidad", "Capacidad carga", "Capacidad de carga",
    "Capacidad de carga (kg)", "Capacidad de plataforma", "Capacidad máxima de plataforma", "Capacidad de la cesta"], "kg");
  if (capacity !== expected.loadCapacityKg || facts.loadCapacityKg !== null && facts.loadCapacityKg !== capacity) return specs;
  if (explicitGeometry.test(sourceText) || geometryConfigurationConflict.test(sourceText)) return specs;
  const additions: Record<string, string> = {};
  const sources = [original.specs, specs];
  if (sources.some((source) => Object.entries(source).some(([key, value]) =>
    geometryConfigurationConflict.test(fold(`${key} ${String(value)}`))))) return specs;
  for (const fact of claim.facts) {
    const aliases = geometryAliases[fact.field];
    if (!aliases) return specs;
    const isDimension = fact.field === "Longitud de plataforma" || fact.field === "Anchura de plataforma";
    if (isDimension && sources.some((source) => Object.keys(source).some((key) => combinedGeometry.test(fold(key))))) continue;
    const expectedValue = editorialMetricOf({ [fact.field]: fact.value }, [fact.field]);
    if (expectedValue === null) return specs;
    const existing = sources.flatMap((source) => Object.keys(source).filter((key) => aliases.test(fold(key)))
      .map((key) => editorialMetricOf(source, [key])));
    if (existing.some((value) => value !== expectedValue)) return specs;
    if (fact.field === "Altura de plataforma" && sources.some((source) =>
      editorialMetricOf(source, ["Altura"]) === expectedValue)) continue;
    if (existing.length === 0) additions[fact.field] = fact.value;
  }
  if (!Object.keys(additions).length) return specs;
  const result = { ...specs, ...additions };
  observeDocumentedTechnicalAddition(original, specs, result, claim.url,
    "src/preparation/technical/documented-technical-evidence.ts", observe);
  return result;
};

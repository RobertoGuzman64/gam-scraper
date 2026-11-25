import { createHash } from "node:crypto";
import { matchesTechnicalDocumentVerification } from "../../contracts/technical-provenance.js";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";
import type { DocumentedTechnicalSource as ProvenanceSource, ProductTechnicalProvenance } from "../../contracts/technical-provenance.js";
import type { TechnicalRecoveryObservation } from "../provenance/technical-recovery-observation.js";
import { reviewedCatalogModelIdentity, matchesDocumentedTechnicalIdentity } from "./reviewed-catalog-model-identity.js";
import { reusableReviewedModelClaims, reviewedModelDocumentVerification } from "./reviewed-model-claims.js";

import { editorialFamilyFromSourceGeneral, editorialFamilyOf } from "../editorial/core/editorial-families.js";
import { resolveEditorialLiteralTitleSource, resolveEditorialSource } from "../editorial/core/editorial-source.js";
import { resolveEditorialFacts } from "../editorial/core/editorial-facts.js";
import type { EditorialEnergy } from "../editorial/core/editorial-facts.js";
import { editorialMetricOf, editorialQuantityOf, editorialQuantity } from "../editorial/measurements/editorial-measurements.js";
import { fold } from "../classification/category-utils.js";
import { containsEditorialBrandModel, containsEditorialIdentity } from "../editorial/identity/editorial-identity-match.js";
import { verifiedEditorialUrl } from "../editorial/source/editorial-source-url.js";

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
  "Longitud de plumín": /^(?:longitud|largo) (?:de(?:l)? )?(?:plumin|jib|brazo auxiliar)(?: \(m[m]?\))?$/u,
  "Rotación de torreta": /^(?:rotacion|giro|angulo de giro).*(?:torreta|torre)\b|^torreta giratoria$/u,
  "Rotación de cesta": /^(?:rotacion|giro|angulo de giro).*(?:cesta|plataforma)\b/u,
  "Extensión de plataforma": /^(?:extension(?: de (?:la )?(?:plataforma|cesta))?|longitud (?:de )?extension|plataforma (?:extensible|desplegable|desplazable)|lateral extensible)(?: \(m[m]?\))?$/u
};

const angularGeometry = (field: string): boolean => field === "Rotación de torreta" || field === "Rotación de cesta";
const geometryAngle = (value: unknown): number | null => {
  const match = typeof value === "string" ? /^(\d{1,3})\s*[°º]$/u.exec(value.trim()) : null;
  const angle = Number(match?.[1]);
  return Number.isInteger(angle) && angle > 0 && angle <= 360 ? angle : null;
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
  const primary = claims.filter((claim) => !claim.fallback);
  const fallback = claims.filter((claim) => claim.fallback);
  if (primary.length > 1 || fallback.length > 1 || fallback.length && primary.length !== 1) return specs;
  const result = primary[0] ? recoverReviewedModelClaim(original, specs, primary[0], observe) : specs;
  return result !== specs || !fallback[0] ? result : recoverReviewedModelClaim(original, specs, fallback[0], observe);
};

const anchoredOfferSlug = (record: ProductRecord): string => {
  const slug = new URL(record.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  if (record.providerId !== "mercaeleva") return slug;
  const url = verifiedEditorialUrl(record.url, ["sales.mercaeleva.com"]);
  if (!url || !/^\/(?:es|en)\/for-sale\/machine\/[^/]+\/?$/iu.test(url.pathname) || !record.reference) return "";
  const suffix = `-${record.reference}`;
  return slug.toLowerCase().endsWith(suffix.toLowerCase()) ? slug.slice(0, -suffix.length) : "";
};

const recoverReviewedModelClaim = (
  original: ProductRecord, specs: SpecsMap, claim: ReturnType<typeof reusableReviewedModelClaims>[number],
  observe?: TechnicalRecoveryObservation
): SpecsMap => {
  if (!original.brand || !original.model || !original.specs) return specs;
  const expected = claim.compatibility;
  if ("sourceAnchors" in expected) {
    const year = Number(original.year);
    const anchoredOffer = expected.anchoredCatalogOffer === true;
    const structuredIdentity = expected.verifiedStructuredIdentity === true;
    const verifiedSource = structuredIdentity ? resolveEditorialSource(original) : null;
    const sourceText = fold([original.shortDescription, original.longDescription].filter(Boolean).join(" "));
    const validYear = expected.firstYear === null && expected.lastYear === null
      ? original.year === null : /^\d{4}$/u.test(original.year ?? "") &&
        expected.firstYear !== null && expected.lastYear !== null && year >= expected.firstYear && year <= expected.lastYear;
    const structuredOffer = anchoredOffer && structuredIdentity && verifiedSource?.brand === original.brand && verifiedSource.model === original.model &&
      containsEditorialBrandModel(original.title ?? "", original.brand, original.model) &&
      containsEditorialBrandModel(original.shortDescription ?? "", original.brand, original.model) &&
      containsEditorialBrandModel(original.longDescription ?? "", original.brand, original.model);
    const validIdentity = anchoredOffer
      ? original.condition === "Nuevo" && !original.serialNumber && !original.horometer && (!structuredIdentity || structuredOffer) &&
        containsEditorialBrandModel(original.title ?? "", original.brand, original.model) &&
        (containsEditorialBrandModel(original.shortDescription ?? "", original.brand, original.model) ||
          containsEditorialIdentity(original.shortDescription ?? "", `${original.brand}${original.model}`) &&
          containsEditorialBrandModel(original.longDescription ?? "", original.brand, original.model))
      : original.condition === "Segunda mano" && (structuredIdentity
        ? verifiedSource?.brand === original.brand && verifiedSource.model === original.model &&
          comparableIdentifier(original.title ?? "") === comparableIdentifier(original.model) &&
          !original.shortDescription?.trim() && !original.longDescription?.trim()
        : comparableIdentifier(original.title ?? "") === comparableIdentifier(`${original.brand} ${original.model}`));
    const generalFamily = editorialFamilyFromSourceGeneral(original.longDescription);
    const sourceFamily = generalFamily ?? (verifiedSource ? editorialFamilyOf(verifiedSource.familyClues) :
      expected.familyFromSourcePath ? editorialFamilyOf(new URL(original.url).pathname) : null);
    if (!validYear || !validIdentity ||
      (!containsEditorialBrandModel(new URL(original.url).pathname, original.brand, original.model) && !structuredOffer) ||
      anchoredOffer && !comparableIdentifier(anchoredOfferSlug(original))
        .endsWith(comparableIdentifier(structuredOffer ? original.model : `${original.brand}${original.model}`)) ||
      sourceFamily !== expected.family ||
      ((!structuredIdentity || anchoredOffer) && Object.keys(original.specs).length !== Object.keys(expected.sourceAnchors).length) ||
      (structuredIdentity && Object.entries(original.specs).some(([key, value]) =>
        expected.conflictingEvidence.test(fold(`${key} ${String(value)}`)))) ||
      Object.entries(expected.sourceAnchors).some(([key, value]) =>
        typeof original.specs?.[key] !== "string" || fold(String(original.specs[key])) !== fold(value)) ||
      expected.corroboratingText && !expected.corroboratingText.test(fold(original.longDescription ?? "")) ||
      expected.conflictingEvidence.test(sourceText)) return specs;
    const result = { ...specs };
    for (const fact of claim.facts) {
      if (Object.keys(specs).some((key) => comparableIdentifier(key) === comparableIdentifier(fact.field) ||
        expected.conflictingEvidence.test(fold(key)))) return specs;
      result[fact.field] = fact.value;
    }
    observeDocumentedTechnicalAddition(original, specs, result, claim.url,
      "src/preparation/technical/documented-technical-evidence.ts", observe);
    return result;
  }
  const source = resolveEditorialSource(original);
  const generalFamily = editorialFamilyFromSourceGeneral(original.longDescription);
  const shortFamily = editorialFamilyOf(original.shortDescription ?? "");
  const categoryFamily = editorialFamilyOf(`${original.subcategory ?? ""} ${original.categoryName}`);
  const genericPlatformSource = expected.family.startsWith("plataforma-") && source &&
    !editorialFamilyOf(source.familyClues) && resolveEditorialLiteralTitleSource(original) === "producto" &&
    generalFamily === expected.family && (!shortFamily || shortFamily === expected.family) &&
    (!categoryFamily || categoryFamily === expected.family);
  const facts = resolveEditorialFacts(original) ?? (genericPlatformSource ? resolveEditorialFacts(original, expected.family) : null);
  if (!facts || facts.brand !== original.brand || facts.model !== original.model ||
    facts.family !== expected.family) return specs;
  const sourceText = fold([original.title, original.shortDescription, original.longDescription].filter(Boolean).join(" "));
  const escapedModel = fold(original.model).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  if (new RegExp(`\\b${escapedModel}[-/][a-z0-9]+`, "u").test(sourceText)) return specs;
  if (expected.family === "carretilla-elevadora") {
    if (facts.loadCapacityKg !== expected.loadCapacityKg ||
      facts.energy !== null && facts.energy !== expected.energy || nominalLoadCenter.test(sourceText)) return specs;
    const battery = original.specs["Capacidad de la batería"];
    const batteryVoltage = typeof battery === "string" ? Number(/^\s*(\d+)\s*V\b/iu.exec(battery)?.[1]) : null;
    if ("catalogOffer" in expected) {
      if (!source || original.condition !== "Nuevo" || original.year !== null || original.serialNumber || original.horometer ||
        (original.country ? fold(original.country) !== fold(expected.marketCountry) : !new URL(original.url).pathname.startsWith("/es/")) ||
        !containsEditorialBrandModel(new URL(original.url).pathname, original.brand, original.model) ||
        !containsEditorialBrandModel(original.title ?? "", original.brand, original.model) ||
        !containsEditorialBrandModel(original.shortDescription ?? "", original.brand, original.model) ||
        !containsEditorialBrandModel(original.longDescription ?? "", original.brand, original.model) ||
        typeof original.specs.Marca !== "string" || fold(original.specs.Marca) !== fold(original.brand) ||
        typeof original.specs.Modelo !== "string" || fold(original.specs.Modelo) !== fold(original.model) ||
        Object.keys(original.specs).some((key) => /^(?:ano|ano de fabricacion|ano del modelo)$/u.test(fold(key))) ||
        /\b(?:segunda mano|usad[oa]|reacondicionad[oa]|reconvertid[oa])\b/u.test(sourceText)) return specs;
      if ("invariantLoadCenter" in expected) {
        if (expected.lengthM !== undefined && facts.lengthM !== expected.lengthM ||
          expected.identityWeightKg !== undefined && facts.weightKg !== expected.identityWeightKg) return specs;
        if (expected.voltageV !== undefined && (facts.voltageV !== null && facts.voltageV !== expected.voltageV ||
          battery !== undefined && batteryVoltage !== expected.voltageV)) return specs;
      } else {
        const width = original.specs.Anchura;
        const hasOtherWidth = Object.keys(original.specs).some((key) => ["Ancho total", "Anchura total", "Ancho"].includes(key));
        const widths = facts.widthM !== null ? [facts.widthM] : !hasOtherWidth && typeof width === "string" && /^\d+(?:\s*\/\s*\d+)+\s*mm$/iu.test(width)
          ? width.replace(/\s*mm$/iu, "").split("/").map((value) => editorialQuantity(`${value.trim()} mm`, "mm"))
            .map((value) => value === null ? null : value / 1000) : [];
        if (facts.lengthM === null || expected.lengthM === null || Math.abs(facts.lengthM - expected.lengthM) > 0.005 ||
          widths.length === 0 || widths.some((value) => value === null || !expected.widthsM.includes(value))) return specs;
      }
    } else if (("invariantUsedLoadCenter" in expected && expected.invariantUsedLoadCenter === true
      ? original.condition !== "Segunda mano" || original.country !== null && fold(original.country) !== fold(expected.marketCountry) ||
        comparableIdentifier(original.title ?? "") !== comparableIdentifier(`${original.brand} ${original.model}`) ||
        !containsEditorialBrandModel(new URL(original.url).pathname, original.brand, original.model) ||
        Object.keys(original.specs).some((key) => !/^(?:altura de trabajo|capacidad|motor)$/u.test(fold(key)))
      : !original.country || fold(original.country) !== fold(expected.marketCountry)) ||
      !original.year || !/^\d{4}$/u.test(original.year) || Number(original.year) < expected.firstYear ||
      expected.lastYear !== undefined && Number(original.year) > expected.lastYear ||
      expected.lengthM !== undefined && facts.lengthM !== expected.lengthM ||
      expected.widthM !== undefined && facts.widthM !== expected.widthM) return specs;
    const energyEvidence = fold([original.title, original.shortDescription, original.longDescription,
      ...Object.entries(original.specs).filter(([key]) => /^(?:motor|tipo (?:de )?motor|motorizacion|energia|combustible)$/u.test(fold(key)))
        .map(([, value]) => String(value))].filter(Boolean).join(" "));
    if (/\b(?:sin|no (?:es|usa|utiliza|funciona con)|convertid[oa] a)\s+(?:motor (?:de )?)?(?:glp|lpg|diesel|gasoil|gasolina|electric[oa]s?|bateria)\b/u.test(energyEvidence)) return specs;
    const energies = new Set([...energyEvidence.matchAll(energyPattern)].map((match) => energyIdentifier(match[0])));
    const corroboratedOfferEnergy = "invariantLoadCenter" in expected && expected.energy === "eléctrica" &&
      energies.size === 0 && expected.identityWeightKg !== undefined && facts.weightKg === expected.identityWeightKg &&
      expected.voltageV !== undefined && (facts.voltageV === expected.voltageV || batteryVoltage === expected.voltageV);
    if (!expected.energy || !corroboratedOfferEnergy && (energies.size !== 1 || !energies.has(expected.energy))) return specs;
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
  const headingEnergy = /^\s*(?:las?\s+|los?\s+)?(?:tijeras?|articuladas?|telescopicos?)\s+(electric[oa]s?|diesel)\b/u
    .exec(fold(original.longDescription ?? ""))?.[1];
  const hasStructuredEnergy = Object.keys(original.specs).some((key) =>
    /^(?:motor|tipo (?:de )?motor|motorizacion|energia|combustible)$/u.test(fold(key)));
  const energyText = fold([original.title, original.shortDescription, original.longDescription,
    source?.familyClues].filter(Boolean).join(" "));
  const declaredEnergies = new Set([...energyText.matchAll(energyPattern)].map((match) => energyIdentifier(match[0])));
  const corroboratedHeadingEnergy = facts.energy === null && !hasStructuredEnergy && generalFamily === expected.family &&
    (!shortFamily || shortFamily === expected.family) &&
    headingEnergy !== undefined && energyIdentifier(headingEnergy) === expected.energy &&
    declaredEnergies.size === 1 && declaredEnergies.has(expected.energy) &&
    !/\b(?:sin|no (?:es|usa|utiliza|funciona con)|convertid[oa] a)\s+(?:motor (?:de )?)?(?:glp|lpg|diesel|gasoil|gasolina|electric[oa]s?|bateria)\b/u.test(energyText);
  const advertisedHeightClass = "advertisedHeightClassM" in expected && expected.advertisedHeightClassM !== undefined &&
    expected.family === "plataforma-tijera" && facts.workingHeightM === null &&
    facts.liftingHeightM === expected.advertisedHeightClassM && facts.platformHeightM === null &&
    !Object.keys(original.specs).some((key) => /^altura (?:maxima )?(?:de )?trabajo(?: \(m[m]?\))?$/u.test(fold(key))) &&
    ![...sourceText.matchAll(/\baltura (?:maxima )?(?:de )?trabajo (?:de |hasta )?(\d+(?:[.,]\d+)?)\s*(?:m|metros?)\b/gu)].some((match) => {
      const value = Number(match[1]?.replace(",", "."));
      return value !== expected.workingHeightM && value !== expected.advertisedHeightClassM;
    }) &&
    generalFamily === expected.family && shortFamily === expected.family &&
    containsEditorialBrandModel(original.title ?? "", original.brand, original.model) &&
    containsEditorialBrandModel(original.shortDescription ?? "", original.brand, original.model) &&
    containsEditorialBrandModel(original.longDescription ?? "", original.brand, original.model);
  const corroboratedAdvertisedEnergy = advertisedHeightClass && facts.energy === null && !hasStructuredEnergy &&
    expected.energy !== null && declaredEnergies.size === 1 && declaredEnergies.has(expected.energy);
  if ((facts.energy !== expected.energy && !corroboratedHeadingEnergy && !corroboratedAdvertisedEnergy) ||
    (facts.workingHeightM !== expected.workingHeightM && !advertisedHeightClass)) return specs;
  if ("invariantGeometry" in expected) {
    const modelToken = fold(original.model).replace(/[^a-z0-9]/gu, "");
    const variantPattern = new RegExp(`(?:^|[^a-z0-9])${[...modelToken].join("[^a-z0-9]{0,3}")}[^a-z0-9]+(?:pro|trax|ae)(?![a-z0-9])`, "u");
    if (variantPattern.test(sourceText) || variantPattern.test(fold(new URL(original.url).pathname))) return specs;
    const fixedScissorDeck = expected.family === "plataforma-tijera" &&
      claim.facts.every((fact) => fact.field === "Longitud de plataforma" || fact.field === "Anchura de plataforma" || fact.field === "Extensión de plataforma");
    if (claim.fallback && (!fixedScissorDeck || claim.facts.some((fact) => fact.field === "Extensión de plataforma")) && (expected.family !== "plataforma-articulada" || facts.lengthM !== null || facts.widthM !== null ||
      facts.loadCapacityKg !== null || claim.facts.some((fact) => fact.field !== "Anchura de plataforma"))) return specs;
    if (!expected.energy || facts.energy !== expected.energy || !original.year || !/^\d{4}$/u.test(original.year) ||
      facts.year !== Number(original.year) || facts.year < expected.firstYear || facts.year > expected.lastYear ||
      !containsEditorialBrandModel(original.title ?? "", original.brand, original.model) ||
      !containsEditorialBrandModel(original.longDescription ?? "", original.brand, original.model) ||
      new RegExp(`\\b${escapedModel}\\s+(?:serie(?:s)?\\s+[a-z0-9]+|s(?:i{1,3}|[123])|[a-z]{1,3}[0-9]+)\\b`, "u").test(sourceText) ||
      declaredEnergies.size !== 1 || !declaredEnergies.has(expected.energy) ||
      /\b(?:sin|no (?:es|usa|utiliza|funciona con)|convertid[oa] a)\s+(?:motor (?:de )?)?(?:glp|lpg|diesel|gasoil|gasolina|electric[oa]s?|bateria)\b/u.test(energyText) ||
      claim.facts.some((fact) => expected.family === "plataforma-tijera" ? !fixedScissorDeck && fact.field !== "Extensión de plataforma" :
        fact.field !== "Anchura de plataforma" && fact.field !== "Longitud de plumín" && !angularGeometry(fact.field))) return specs;
    if (original.condition !== "Segunda mano" || !source ||
      !containsEditorialBrandModel(new URL(original.url).pathname, original.brand, original.model) ||
      original.shortDescription && !containsEditorialBrandModel(original.shortDescription, original.brand, original.model) ||
      new RegExp(`\\b${escapedModel}\\s+(?:ii|iii|iv)\\b`, "u").test(sourceText)) return specs;
    if (expected.family === "plataforma-tijera" &&
      /\b(?:extension|extensible|desplazable|desplegable|modificad[oa]|sustituid[oa]|convertid[oa])\b/u.test(sourceText)) return specs;
    if ([original.specs, specs].some((source) => Object.entries(source).some(([key, value]) => {
      const label = fold(key);
      return combinedGeometry.test(label) ||
        /^(?:ano|ano de fabricacion|ano del modelo)$/u.test(label) && String(value).trim() !== original.year ||
        /^(?:motor|tipo (?:de )?motor|motorizacion|energia|combustible)$/u.test(label) &&
          [...fold(String(value)).matchAll(energyPattern)].some((match) => energyIdentifier(match[0]) !== expected.energy);
    }))) return specs;
  } else {
    if (facts.lengthM !== expected.lengthM || facts.widthM !== expected.widthM) return specs;
    if (expected.firstYear !== undefined || expected.lastYear !== undefined) {
      if (!original.year || !/^\d{4}$/u.test(original.year) || facts.year !== Number(original.year) ||
        expected.firstYear !== undefined && facts.year < expected.firstYear ||
        expected.lastYear !== undefined && facts.year > expected.lastYear ||
        !containsEditorialBrandModel(original.title ?? "", original.brand, original.model) ||
        !containsEditorialBrandModel(original.longDescription ?? "", original.brand, original.model) ||
        declaredEnergies.size !== 1 || !expected.energy || !declaredEnergies.has(expected.energy) ||
        /\b(?:sin|no (?:es|usa|utiliza|funciona con)|convertid[oa] a)\s+(?:motor (?:de )?)?(?:glp|lpg|diesel|gasoil|gasolina|electric[oa]s?|bateria)\b/u.test(energyText) ||
        Object.entries(original.specs).some(([key, value]) => /^(?:ano|ano de fabricacion|ano del modelo)$/u.test(fold(key)) && String(value).trim() !== original.year)) return specs;
    }
    const capacity = editorialQuantityOf(original.specs, ["Capacidad", "Capacidad carga", "Capacidad de carga",
      "Capacidad de carga (kg)", "Capacidad de plataforma", "Capacidad máxima de plataforma", "Capacidad de la cesta"], "kg");
    if (capacity !== expected.loadCapacityKg || facts.loadCapacityKg !== null && facts.loadCapacityKg !== capacity) return specs;
  }
  if (("invariantGeometry" in expected || claim.facts.some((fact) => fact.field === "Longitud de plumín")) && (
    /\b(?:plumin|jib|brazo auxiliar)\b/u.test(sourceText) ||
    [original.specs, specs].some((source) => Object.keys(source).some((key) => {
      const label = fold(key);
      return /\b(?:plumin|jib|brazo auxiliar)\b/u.test(label) && !geometryAliases["Longitud de plumín"]?.test(label);
    })))) return specs;
  if (explicitGeometry.test(sourceText) || geometryConfigurationConflict.test(sourceText)) return specs;
  const additions: Record<string, string> = {};
  const sources = [original.specs, specs];
  if (sources.some((source) => Object.entries(source).some(([key, value]) =>
    geometryConfigurationConflict.test(fold(`${key} ${String(value)}`))))) return specs;
  for (const fact of claim.facts) {
    const aliases = geometryAliases[fact.field];
    if (!aliases) return specs;
    const isDimension = fact.field === "Longitud de plataforma" || fact.field === "Anchura de plataforma";
    if (isDimension && "invariantGeometry" in expected && expected.family === "plataforma-tijera" &&
      (facts.lengthM !== null || facts.widthM !== null || facts.loadCapacityKg !== null)) continue;
    if (isDimension && sources.some((source) => Object.keys(source).some((key) => combinedGeometry.test(fold(key))))) continue;
    const angular = angularGeometry(fact.field);
    if (angular && /\b(?:torreta|torre|rotacion|giro|giratoria|modificad[oa]|sustituid[oa]|convertid[oa])\b/u.test(sourceText)) return specs;
    const expectedValue = angular ? geometryAngle(fact.value) : editorialMetricOf({ [fact.field]: fact.value }, [fact.field]);
    if (expectedValue === null) return specs;
    const existing = sources.flatMap((source) => Object.keys(source).filter((key) => aliases.test(fold(key)))
      .map((key) => angular ? geometryAngle(source[key]) : editorialMetricOf(source, [key])));
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

export const reviewedModelEditorialSpecs = (
  original: ProductRecord, provenance: ProductTechnicalProvenance
): SpecsMap => {
  if (!original.brand || !original.model || provenance.originalRecordSha256 !== originalRecordFingerprint(original)) return {};
  return Object.fromEntries(provenance.entries.flatMap((entry) =>
    entry.scope === "model-document" && entry.document.brand === original.brand && entry.document.model === original.model &&
    matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification) ?
      [[entry.field, entry.value]] : []));
};

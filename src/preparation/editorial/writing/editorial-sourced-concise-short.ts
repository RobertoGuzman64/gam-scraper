import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";
import { resolveEditorialSource } from "../core/editorial-source.js";
import { normalizeEditorialSummary } from "../core/editorial-normalization.js";
import { containsEditorialBrandModel } from "../identity/editorial-identity-match.js";
import { containsEditorialSourceSlugModel } from "../source/editorial-source-url.js";
import { editorialMetricOf, editorialQuantityOf, formatEditorialQuantity } from "../measurements/editorial-measurements.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { sameEditorialUnit } from "../core/editorial-source-contract.js";

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");

const quantities = (value: string): ReadonlySet<string> => new Set(
  [...value.matchAll(/\d+(?:[.,]\d+)*/gu)].map((match) => match[0].replace(/[.,]/gu, ""))
);

const marketingTail = /,\s*(?:ideal\s+para|perfect[oa]\s+para|cumpliendo\s+con|diseñad[oa]\s+para|combinando\s+|lo\s+que\s+)[^,.]*\.?$/iu;

const attributes = /\b(?:el[eé]ctric[oa]s?|di[eé]sel|glp|gasolina|h[ií]brid[oa]s?|litio|hepa|hidr[aá]ulic[oa]s?|regenerativ[oa]s?|bater[ií]as?|antihuellas|estabilizadores?|mosfet|cabina|inoxidable)\b/giu;

export const resolveSourcedConciseShort = (
  source: ProductRecord, prepared: ProductRecord, short: string | null, general: string | null, authenticatedOrigin: boolean
): string | null => {
  const original = source.shortDescription?.trim();
  if (!original || !short?.trim() || !general?.trim() ||
    !sameEditorialUnit(source, prepared) || !authenticatedOrigin ||
    short.trim().split(/\s+/u).length <= 45 || !source.title?.trim() ||
    normalize(original) !== normalize(short)) return null;
  const sentences = short.trim().split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u);
  const first = sentences[0]?.trim();
  const count = first?.split(/\s+/u).length ?? 0;
  if (!first || sentences.length < 2 || count < 12 || count > 40) return null;
  const name = normalize(first);
  const model = normalize(source.model ?? "");
  const title = normalize(source.title);
  const modelSuffix = model.length >= 5 && /\d/u.test(model) ? model.slice(1) : "";
  if (modelSuffix && [...(source.longDescription ?? "").matchAll(/\b[A-Z]{2,5}\d[A-Z0-9-]{2,}\b/gu)]
    .some((match) => normalize(match[0]) !== model && normalize(match[0]).endsWith(modelSuffix))) return null;
  if (!(model.length >= 3 && name.includes(model) || title.length >= 12 && name.includes(title))) return null;
  const remaining = short.trim().slice(first.length);
  const retained = `${first} ${general}`;
  const retainedNumbers = quantities(retained);
  if ([...quantities(remaining)].some((number) => !retainedNumbers.has(number))) {
    if (sentences.length !== 2) return null;
    const shortened = sentences.map((sentence) => sentence.replace(marketingTail, ".")).join(" ");
    if (shortened.split(/\s+/u).length > 45 || normalize(shortened) === normalize(short)) return null;
    const preserved = `${shortened} ${general}`;
    if ([...quantities(short)].some((number) => !quantities(preserved).has(number)) ||
      [...short.matchAll(attributes)].some((match) => !normalize(preserved).includes(normalize(match[0])))) return null;
    return shortened;
  }
  const retainedTerms = normalize(retained);
  if ([...remaining.matchAll(attributes)].some((match) => !retainedTerms.includes(normalize(match[0])))) return null;
  return first;
};

export const resolveSourcedScrubberShort = (source: ProductRecord, prepared: ImportCandidate, current: string | null): string | null => {
  const original = source.shortDescription?.trim();
  const model = source.model?.trim();
  const title = source.title?.trim();
  if (!original || !model || !title || source.providerId !== prepared.providerId || source.reference !== prepared.reference ||
    source.url !== prepared.sourceUrl || source.condition !== "Nuevo" || source.specs?.Modelo !== model ||
    current !== normalizeEditorialSummary(original, model)) return null;
  const identity = /^➨\s*([\p{L}][\p{L}\d-]*)\s+([\p{L}\d.-]+)\s+Nueva\s+➨\s*Venta\s+(?:de\s+)?fregadora\s+(?:de\s+)?conductor\s+sentado$/iu.exec(original);
  const brand = identity?.[1];
  if (!brand || identity?.[2] !== model || source.brand && source.brand !== brand ||
    normalize(title) !== normalize(`Fregadora ${brand} ${model}`) || normalize(prepared.title ?? "") !== normalize(title) ||
    !resolveEditorialSource({ ...source, brand })) return null;
  const slug = new URL(source.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  const general = source.longDescription ?? "";
  if (!/\bfregadora\b/iu.test(slug) || !/\b(?:conductor|operario)-sentado\b/iu.test(slug) ||
    !containsEditorialSourceSlugModel(slug, model, undefined) || !normalize(slug).endsWith(normalize(`${brand} ${model}`)) ||
    !containsEditorialBrandModel(general, brand, model) || !/\b(?:operario|conductor)\s+(?:a bordo|sentado)\b/iu.test(general) ||
    /\b(?:opcional|sin conductor|de pie|acompa[ñn]ante)\b/iu.test(general)) return null;
  const length = editorialMetricOf(source.specs, ["Longitud"]);
  const weight = editorialQuantityOf(source.specs, ["Peso"], "kg");
  if (length === null || length < 0.5 || length > 5 || length !== editorialMetricOf(prepared.spec, ["Longitud"]) ||
    weight === null || weight < 50 || weight > 5000 || weight !== editorialQuantityOf(prepared.spec, ["Peso"], "kg")) return null;
  return `Fregadora ${brand} ${model} nueva, de conductor sentado, con longitud declarada de ${formatEditorialQuantity(length)} m y peso de ${formatEditorialQuantity(weight)} kg.`;
};

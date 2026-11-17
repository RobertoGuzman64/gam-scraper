import type { ProductRecord } from "../../../../contracts/catalog.js";
import { sameEditorialUnit } from "./editorial-source-contract.js";

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

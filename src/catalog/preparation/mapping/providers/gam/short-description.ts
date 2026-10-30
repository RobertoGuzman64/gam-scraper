import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { resolveGamGeneralDescription } from "./general-description.js";

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const wordCount = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;

const numericTokens = (value: string): ReadonlySet<string> =>
  new Set(value.match(/\d+(?:[.,]\d+)*/gu) ?? []);

const ownIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !record.reference || !record.title ||
    !record.shortDescription) return false;

  const model = normalize(record.model ?? "");
  const brand = normalize(record.brand ?? "");
  const title = normalize(record.title);
  const short = normalize(record.shortDescription);
  if (model && (!title.includes(model) || !short.includes(model))) return false;
  if (brand && (!title.includes(brand) || !short.includes(brand))) return false;
  if (record.externalReference && record.model &&
    normalize(record.externalReference) !== model) return false;

  const specModel = record.specs?.Modelo;
  const specBrand = record.specs?.Marca;
  if (specModel !== undefined && (typeof specModel !== "string" ||
    !model || normalize(specModel) !== model)) return false;
  if (specBrand !== undefined && (typeof specBrand !== "string" ||
    !brand || normalize(specBrand) !== brand)) return false;

  try {
    const url = new URL(record.url);
    const slug = url.pathname.split("/").at(-1) ?? "";
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" &&
      slug.startsWith(`${record.reference}-`) && !url.search && !url.hash &&
      (!model || normalize(slug).includes(model));
  } catch {
    return false;
  }
};

const missingFacts = (original: string, summary: string, general: string): boolean => {
  const retained = `${summary} ${general}`;
  const remaining = original.slice(summary.length);
  const keptNumbers = numericTokens(retained);
  if ([...numericTokens(remaining)].some((value) => !keptNumbers.has(value))) return true;

  const keywords = /\b(?:el[eé]ctric[oa]s?|di[eé]sel|glp|gasolina|h[ií]brid[oa]s?|litio|hepa|hidr[aá]ulic[oa]s?)\b/giu;
  const kept = normalize(retained);
  return [...remaining.matchAll(keywords)].some((match) => !kept.includes(normalize(match[0])));
};

const conciseLongShort = (record: ProductRecord): string | null => {
  const original = record.shortDescription?.trim();
  const general = record.longDescription?.trim();
  if (!original || !general || wordCount(original) <= 45 || !ownIdentity(record)) return null;

  const sentences = original.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u);
  if (sentences.length < 2) return null;
  const first = sentences[0]?.trim();
  if (!first || wordCount(first) < 12 || wordCount(first) > 45) return null;

  const second = sentences[1]?.trim();
  const summary = second && wordCount(`${first} ${second}`) <= 45 ? `${first} ${second}` : first;
  const normalizedSummary = normalize(summary);
  if (record.model && !normalizedSummary.includes(normalize(record.model))) return null;
  if (record.brand && !normalizedSummary.includes(normalize(record.brand))) return null;
  if ([...numericTokens(summary)].some((value) => !numericTokens(general).has(value)) ||
    missingFacts(original, summary, general)) return null;

  return summary;
};

const conciseModule = (record: ProductRecord): string | null => {
  if (!record.title || record.shortDescription?.trim() !== record.title.trim() ||
    wordCount(record.title) >= 10) return null;
  const height = record.specs?.Altura;
  const heightMm = typeof height === "string" && /^(\d+) mm$/u.test(height)
    ? Number(height.split(" ")[0]) : null;
  if (heightMm === null || heightMm < 1800 || heightMm > 4000) return null;
  const general = resolveGamGeneralDescription(record);
  if (!general || !/^El m[oó]dulo de ba[nñ]o /iu.test(general)) return null;
  const first = general.split(/(?<=[.!?])\s+/u)[0]?.trim();
  return first && wordCount(first) <= 45 ? first : null;
};

export const resolveGamShortDescription = (record: ProductRecord): string | null =>
  record.providerId === "gam" ? conciseModule(record) ?? conciseLongShort(record) : null;

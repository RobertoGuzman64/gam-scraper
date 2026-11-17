import type { ProductRecord } from "../../../../contracts/catalog.js";
import { sameEditorialUnit } from "./editorial-source-contract.js";

const normalized = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");

const numbers = (value: string): ReadonlySet<string> => new Set(
  [...value.matchAll(/\d+(?:[.,]\d+)*/gu)].map((match) => match[0].replace(/[.,]/gu, ""))
);

const protectedTerms = /\b(?:el[eé]ctric[oa]s?|di[eé]sel|glp|gasolina|h[ií]brid[oa]s?|litio|hepa|hidr[aá]ulic[oa]s?|mosfet|regenerativ[oa]s?|antihuellas|estabilizadores?|bater[ií]as?|inoxidable)\b/giu;

const wordCount = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;

const identityIn = (source: ProductRecord, sentence: string): boolean => {
  const title = normalized(source.title ?? "");
  const model = normalized(source.model ?? "");
  const candidate = normalized(sentence);
  if (model.length >= 4 && title.includes(model) && candidate.includes(model)) return true;
  if (title.length >= 12 && candidate.includes(title)) return true;
  const tail = (source.title ?? "").trim().split(/\s+/u).slice(-2).join(" ");
  return tail.length >= 7 && /\d/u.test(tail) && candidate.includes(normalized(tail));
};

export const resolveSourcedShortSummary = (
  source: ProductRecord, prepared: ProductRecord,
  short: string | null, general: string | null, authenticatedOrigin: boolean
): string | null => {
  const original = source.shortDescription?.trim();
  const text = short?.trim();
  if (!authenticatedOrigin || !original || !text || !general?.trim() ||
    !sameEditorialUnit(source, prepared) || !source.title?.trim() ||
    wordCount(text) <= 45 || wordCount(text) > 180 ||
    /https?:\/\/|<[^>]+>|@/u.test(text)) return null;
  const sourceSentences = original.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u);
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u);
  const first = sentences[0]?.trim();
  if (!first || sentences.length < 2 || sourceSentences.length < 2 ||
    normalized(first) !== normalized(sourceSentences[0] ?? "")) return null;
  let candidate = first;
  if (!identityIn(source, candidate)) {
    const second = sentences[1]?.trim() ?? "";
    if (!identityIn(source, second) || !source.model ||
      !normalized(source.title).includes(normalized(source.model))) return null;
    candidate = `${source.title.trim()}. ${second}`;
  }
  if (wordCount(candidate) < 10 || wordCount(candidate) > 45 ||
    !/[.!?]$/u.test(candidate)) return null;
  const retention = `${candidate} ${general}`;
  const retentionNumbers = numbers(retention);
  if ([...numbers(text)].some((value) => !retentionNumbers.has(value))) return null;
  const supportedNumbers = numbers(`${source.title} ${general}`);
  if ([...numbers(candidate)].some((value) => !supportedNumbers.has(value))) return null;
  const retainedTerms = normalized(retention);
  if ([...text.matchAll(protectedTerms)].some((match) => !retainedTerms.includes(normalized(match[0])))) return null;
  return candidate === text ? null : candidate;
};

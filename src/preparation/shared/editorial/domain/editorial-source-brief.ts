import type { ProductRecord } from "../../../../contracts/catalog.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";
import { resolveEditorialSource } from "./editorial-source.js";

const fold = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");

const countWords = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;

const numbers = (value: string): ReadonlySet<string> =>
  new Set(value.match(/\d+(?:[.,]\d+)*/gu) ?? []);

const protectedWords = /\b(?:el[eé]ctric[oa]s?|di[eé]sel|glp|gasolina|h[ií]brid[oa]s?|litio|hepa|hidr[aá]ulic[oa]s?|regenerativ[oa]s?)\b/giu;

export const compressVerifiedSourceShort = (
  source: ProductRecord, proposedShort: string | null, general: string | null
): string | null => {
  const original = source.shortDescription?.trim();
  const text = proposedShort?.trim();
  const long = general?.trim();
  if (!original || !text || !long || original !== text || countWords(original) <= 45 ||
    !verifiedEditorialIdentity(source) || !resolveEditorialSource(source)) return null;

  const sentences = original.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u);
  const first = sentences[0]?.trim();
  if (!first || sentences.length < 2 || countWords(first) < 12 || countWords(first) > 45 ||
    !source.brand || !source.model || !fold(first).includes(fold(source.brand)) ||
    !fold(first).includes(fold(source.model))) return null;

  const remainder = original.slice(first.length);
  const retained = `${first} ${long}`;
  const retainedNumbers = numbers(retained);
  if ([...numbers(remainder)].some((value) => !retainedNumbers.has(value))) return null;
  const retainedWords = fold(retained);
  if ([...remainder.matchAll(protectedWords)].some((match) => !retainedWords.includes(fold(match[0])))) return null;

  return first;
};

import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../legacy-export/contracts.js";

type YearSource = Pick<ProductRecord,
  "providerId" | "reference" | "url" | "year" | "yearSource" | "shortDescription" | "longDescription">;
type YearProduct = Pick<ImportCandidate,
  "providerId" | "reference" | "sourceUrl" | "description_general" | "attributes">;

type YearClaim = { readonly year: number; readonly index: number };

export type CommercialYearAssessment = {
  readonly attributeYear: number | null;
  readonly urlYear: number | null;
  readonly inconsistentClaims: readonly number[];
  readonly urlAttributeDisagreement: boolean;
};

const manufactureYearPattern = /\b(?:fabricad[ao]s?\s+en(?:\s+el\s+a[nñ]o)?|a[nñ]o\s+de\s+fabricaci[oó]n(?:\s+de|\s*:)?|fabricaci[oó]n\s+(?:en|de))\s+((?:19|20)\d{2})\b/giu;
const platformYearPattern = /\bplataforma\b[^.!?]{0,115}?\bde\s+((?:19|20)\d{2})\s+es\b/giu;
const yearValue = (year: string | null): number | null =>
  year && /^(?:19|20)\d{2}$/u.test(year) ? Number(year) : null;

const manufacturingClaims = (text: string | null): readonly YearClaim[] => {
  if (!text) return [];
  const found = new Map<number, YearClaim>();
  for (const pattern of [manufactureYearPattern, platformYearPattern]) {
    for (const match of text.matchAll(pattern)) {
      const year = Number(match[1]);
      if (Number.isInteger(year) && match.index !== undefined) found.set(match.index, { year, index: match.index });
    }
  }
  return [...found.values()].sort((a, b) => a.index - b.index);
};

const yearFromGamUrl = (value: Pick<YearProduct, "providerId" | "reference" | "sourceUrl">): number | null => {
  if (value.providerId !== "gam" || !value.reference) return null;
  try {
    const url = new URL(value.sourceUrl);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      url.search || url.hash) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "es" || parts.length !== 3) return null;
    const match = /^(\d+)-((?:19|20)\d{2})-.+$/u.exec(parts[2] ?? "");
    return match?.[1] === value.reference ? Number(match[2]) : null;
  } catch {
    return null;
  }
};

export const assessCommercialYear = (product: YearProduct): CommercialYearAssessment => {
  const years = product.attributes.filter((attribute) => attribute.attributeID === 117 &&
    typeof attribute.value === "number" && Number.isSafeInteger(attribute.value) &&
    attribute.value >= 1900 && attribute.value <= 2099).map((attribute) => Number(attribute.value));
  const attributeYear = years.length === 1 ? years[0] ?? null : null;
  const urlYear = yearFromGamUrl(product);
  const inconsistentClaims = product.providerId === "gam" && attributeYear !== null
    ? [...new Set(manufacturingClaims(product.description_general)
      .filter((claim) => claim.year !== attributeYear).map((claim) => claim.year))]
    : [];
  return { attributeYear, urlYear, inconsistentClaims,
    urlAttributeDisagreement: attributeYear !== null && urlYear !== null && attributeYear !== urlYear };
};

const replaceIncorrectYears = (general: string, expectedYear: number): string => {
  const incorrect = (raw: string): boolean => Number(raw) !== expectedYear;
  let result = general.replace(/\bFabricada en el a[nñ]o ((?:19|20)\d{2}),\s+esta\b/giu,
    (match, year: string) => incorrect(year) ? "Esta" : match);
  result = result.replace(/,\s*fabricada en ((?:19|20)\d{2}) por\b/giu,
    (match, year: string) => incorrect(year) ? ", fabricada por" : match);
  result = result.replace(/,\s*fabricada en ((?:19|20)\d{2}),/giu,
    (match, year: string) => incorrect(year) ? "" : match);
  result = result.replace(/\bde ((?:19|20)\d{2}) es\b/giu,
    (match, year: string) => incorrect(year) ? "es" : match);
  result = result.replace(/a[nñ]o de fabricaci[oó]n ((?:19|20)\d{2}) seg[uú]n su descripci[oó]n original/giu,
    (match, year: string) => incorrect(year) ? "año de fabricación pendiente de confirmación" : match);
  result = result.replace(/La URL sit[uú]a la unidad en ((?:19|20)\d{2}) pero la descripci[oó]n general habla de fabricaci[oó]n en ((?:19|20)\d{2}); el a[nñ]o requiere confirmaci[oó]n\./giu,
    (match, _year: string, other: string) => incorrect(other)
      ? "El año de fabricación de esta unidad requiere confirmación." : match);
  return result;
};

export const normalizeCommercialYearDescription = (
  source: YearSource, description: string | null
): string | null => {
  const expected = yearValue(source.year);
  if (!description || source.providerId !== "gam" || !source.reference || expected === null ||
    (source.yearSource !== "descripcion" && source.yearSource !== "url")) return description;
  const urlYear = yearFromGamUrl({ providerId: source.providerId,
    reference: source.reference, sourceUrl: source.url });
  const short = source.shortDescription ?? "";
  const supported = source.yearSource === "descripcion" &&
    new RegExp(`\\ba[nñ]o\\s*:?[ ]*${expected}\\b`, "iu").test(short) ||
    source.yearSource === "url" && urlYear === expected;
  if (!supported || !manufacturingClaims(source.longDescription).some((claim) => claim.year !== expected)) {
    return description;
  }
  const proposed = replaceIncorrectYears(description, expected);
  if (manufacturingClaims(proposed).some((claim) => claim.year !== expected)) return description;
  return proposed;
};

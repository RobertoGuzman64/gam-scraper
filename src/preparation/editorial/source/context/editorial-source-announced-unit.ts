import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { EditorialFacts } from "../../core/editorial-facts.js";
import { hasUnconditionalEditorialClaim } from "../../claims/editorial-claim-evidence.js";
import { formatEditorialQuantity } from "../../measurements/editorial-measurements.js";
import { verifiedEditorialUnitPair } from "../../identity/editorial-unit-provenance.js";

const announcedYear = /\ba[nñ]o\s+de\s+fabric[\p{L}]{3,18}\s*:?\s*((?:19|20)\d{2})\b/giu;
const announcedHours = /\b(?:horas?|houras?|hours?)\s*:?\s*(\d{1,6})\b/giu;

const hoursInSpec = (value: unknown): number | null => {
  if (typeof value !== "string" || !/^\d+(?:[. ]\d{3})*\s*h$/iu.test(value.trim())) return null;
  const numeric = Number(value.replace(/[^\d]/gu, ""));
  return Number.isSafeInteger(numeric) ? numeric : null;
};

export const corroboratedAnnouncedUnitSummary = (
  record: ProductRecord, source: ProductRecord, facts: EditorialFacts
): string | null => {
  const description = source.longDescription?.trim();
  if (!description || source.shortDescription?.trim() || facts.year === null || facts.hours === null || facts.hours <= 0 ||
    !verifiedEditorialUnitPair(source, record) || source.year !== record.year ||
    source.horometer !== record.horometer || source.year !== String(facts.year) ||
    source.specs?.["Año de fabricación"] !== String(facts.year) ||
    record.specs?.["Año de fabricación"] !== source.specs?.["Año de fabricación"] ||
    hoursInSpec(source.specs?.["Horas laborales"]) !== facts.hours ||
    record.specs?.["Horas laborales"] !== source.specs?.["Horas laborales"] ||
    !hasUnconditionalEditorialClaim(description, announcedYear) ||
    !hasUnconditionalEditorialClaim(description, announcedHours)) return null;
  const years = [...description.matchAll(announcedYear)];
  const hours = [...description.matchAll(announcedHours)];
  if (years.length !== 1 || hours.length !== 1 ||
    Number(years[0]?.[1]) !== facts.year || Number(hours[0]?.[1]) !== facts.hours) return null;
  return `año de fabricación ${facts.year} y ${formatEditorialQuantity(facts.hours)} horas anunciadas`;
};

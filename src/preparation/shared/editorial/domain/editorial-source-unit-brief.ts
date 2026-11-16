import type { ProductRecord } from "../../../../contracts/catalog.js";
import { formatEditorialQuantity } from "./editorial-measurements.js";
import { hasUnconditionalEditorialClaim } from "./editorial-claim-evidence.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";
import { resolvedEditorialUnitFamilies } from "./editorial-unit-provenance.js";

const declaredYear = /\ba[nñ]o(?:\s+de\s+fabricaci[oó]n)?\s*:?\s*((?:19|20)\d{2})\b/giu;
const otherYear = /\b(?:19|20)\d{2}\b/gu;

const corroboratedYear = (source: ProductRecord, prepared: ProductRecord): number | null => {
  const short = source.shortDescription?.trim() ?? "";
  const year = source.year?.trim();
  if (!year || !/^(?:19|20)\d{2}$/u.test(year) || prepared.year !== source.year ||
    source.specs?.["Año de fabricación"] !== undefined && source.specs["Año de fabricación"] !== year ||
    prepared.specs?.["Año de fabricación"] !== undefined && prepared.specs["Año de fabricación"] !== year ||
    [...short.matchAll(otherYear)].some(([value]) => value !== year)) return null;
  const yearDeclarations = [...short.matchAll(declaredYear)];
  const explicit = yearDeclarations.length === 1 && yearDeclarations[0]?.[1] === year &&
    hasUnconditionalEditorialClaim(short, declaredYear) &&
    !/\bno\s+se\s+(?:acredita|conoce|confirma)\s+(?:el\s+)?a[nñ]o\b/iu.test(short);
  const inUrl = source.yearSource === "url" &&
    source.url.includes(`/${source.reference}-${year}-`) && yearDeclarations.length === 0;
  if (!explicit && !inUrl) return null;
  const numeric = Number(year);
  return numeric <= new Date().getUTCFullYear() ? numeric : null;
};

const corroboratedHorometer = (source: ProductRecord, prepared: ProductRecord): number | null => {
  const raw = source.horometer?.trim();
  if (!raw || prepared.horometer !== source.horometer ||
    source.specs?.Horómetro !== source.horometer || prepared.specs?.Horómetro !== source.horometer ||
    /\bhor[oó]metro\s+sustituid[oa]\b/iu.test(`${source.shortDescription ?? ""} ${source.longDescription ?? ""}`)) return null;
  const match = /^(\d{1,6})\s+horas$/iu.exec(raw);
  const hours = match?.[1] ? Number(match[1]) : null;
  return hours !== null && hours > 0 && hours <= 200000 ? hours : null;
};

export const corroboratedSourceUnitBrief = (
  source: ProductRecord, prepared: ProductRecord, brief: string
): string | null => {
  if (!brief.trim() || !verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared)) return null;
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (!families || !families[0] || families[0] !== families[1]) return null;
  const year = corroboratedYear(source, prepared);
  if (year === null || /\b(?:19|20)\d{2}\b/u.test(brief)) return null;
  const hours = corroboratedHorometer(source, prepared);
  const unit = [`año de fabricación ${year}`, hours !== null ? `lectura de horómetro declarada de ${formatEditorialQuantity(hours)} horas` : null]
    .filter((value): value is string => value !== null);
  const text = brief.trim().replace(/[.!?]+$/u, "");
  return `${text}; ${unit.join(" y ")}.`;
};

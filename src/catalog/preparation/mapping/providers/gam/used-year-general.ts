import type { ProductRecord } from "../../../../../contracts/catalog.js";

const normalized = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

const sourceIdentity = (record: ProductRecord): boolean => {
  if (!record.reference || !record.title || !record.brand || !record.model ||
    !normalized(record.title).includes(normalized(record.brand)) ||
    !normalized(record.title).includes(normalized(record.model))) return false;
  if (record.specs?.Marca !== undefined &&
    (typeof record.specs.Marca !== "string" || normalized(record.specs.Marca) !== normalized(record.brand))) return false;
  if (record.specs?.Modelo !== undefined &&
    (typeof record.specs.Modelo !== "string" || normalized(record.specs.Modelo) !== normalized(record.model))) return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" &&
      path[0] === "es" && path.length === 3 &&
      path[2]?.startsWith(`${record.reference}-`) === true &&
      !url.search && !url.hash;
  } catch {
    return false;
  }
};

const yearIsSupported = (record: ProductRecord, year: string): boolean => {
  if (record.yearSource === "ficha") return record.specs?.["Año de fabricación"] === year;
  if (record.yearSource !== "url" || record.specs?.["Año de fabricación"] !== undefined) return false;
  return new URL(record.url).pathname.split("/").at(-1)?.startsWith(`${record.reference}-${year}-`) === true;
};

export const resolveGamUsedYearGeneral = (
  record: ProductRecord,
  short: string | null,
  general: string | null
): string | null => {
  const year = record.year;
  if (record.providerId !== "gam" || record.condition !== "Segunda mano" || !year ||
    !/^(?:19|20)\d{2}$/u.test(year) || Number(year) > 2026 || Number(year) < 1950 ||
    !short || !general || !sourceIdentity(record) || !yearIsSupported(record, year)) return null;
  if (new RegExp(`\\b${year}\\b`, "u").test(`${short} ${general}`)) return null;
  const sourceText = `${record.shortDescription ?? ""} ${record.longDescription ?? ""}`;
  const claims = sourceText.matchAll(/\b(?:fabricad[ao]|fabricaci[oó]n|a[nñ]o de fabricaci[oó]n)\s*(?:en\s*(?:el\s*)?(?:a[nñ]o\s*)?|de\s*)?((?:19|20)\d{2})\b/giu);
  if ([...claims].some((match) => match[1] !== year)) return null;
  return `Año de fabricación declarado para esta unidad: ${year}.\n\n${general}`;
};

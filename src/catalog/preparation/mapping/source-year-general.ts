import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "./providers/mercaeleva/technical.js";

const hasYear = (text: string): boolean => /\b(?:19|20)\d{2}\b/u.test(text);

const sourceYearInGamDescription = (record: ProductRecord, year: string): boolean => {
  try {
    const url = new URL(record.url);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      !url.pathname.includes(`/${record.reference}-`)) return false;
  } catch {
    return false;
  }
  if (record.yearSource === "ficha") return record.specs?.["Año de fabricación"] === year;
  if (record.yearSource !== "descripcion") return false;
  const long = record.longDescription ?? "";
  const years: readonly string[] = long.match(/\b(?:19|20)\d{2}\b/gu) ?? [];
  return years.includes(year) && years.every((item) => item === year) &&
    new RegExp(`\\baño\\s+${year}\\b`, "iu").test(record.shortDescription ?? "");
};

const sourceYearInGomarizDescription = (
  record: ProductRecord, year: string, short: string | null, specs: SpecsMap
): boolean => {
  if (record.condition !== "Segunda mano" || specs["Año de fabricación"] !== year ||
    !new RegExp(`\\baño\\s+${year}\\b`, "iu").test(short ?? "")) return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" &&
      (url.hostname === "gomarizrent.com" || url.hostname === "www.gomarizrent.com") &&
      path.length === 4 && path[0] === "venta";
  } catch {
    return false;
  }
};

const sourceYearInMercaelevaDescription = (record: ProductRecord, year: string): boolean =>
  validMercaelevaTechnicalSource(record) && record.specs?.["Año de fabricación"] === year &&
  record.specs?.["Año del modelo"] === undefined &&
  Boolean(record.brand && record.model && record.specs?.Marca === record.brand &&
    record.specs?.Modelo === record.model);

export const includeSourceYearInGeneral = (
  record: ProductRecord, general: string | null, short: string | null, specs: SpecsMap
): string | null => {
  const year = record.year?.trim();
  if (!general?.trim() || !year || !/^(?:19|20)\d{2}$/u.test(year) ||
    hasYear(general) || !record.reference ||
    (record.providerId !== "gam" && record.categoryKey !== "venta")) return general;

  const valid = record.providerId === "gam" ? sourceYearInGamDescription(record, year) :
    record.providerId === "gomariz" ? sourceYearInGomarizDescription(record, year, short, specs) :
      record.providerId === "mercaeleva" ? sourceYearInMercaelevaDescription(record, year) : false;
  const text = general.trim();
  return valid ? `${text}${/[.!?]$/u.test(text) ? "" : "."} Año de fabricación de esta unidad: ${year}.` : general;
};

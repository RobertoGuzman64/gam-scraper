import type { ProductRecord } from "../../../contracts/catalog.js";
import { editorialQuantityOf, formatEditorialQuantity } from "../measurements/editorial-measurements.js";
import { sameEditorialUnit } from "../core/editorial-source-contract.js";

const wordCount = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;

export const resolveSourcedShortDiscrepancy = (
  source: ProductRecord, prepared: ProductRecord, short: string | null, authenticatedOrigin: boolean
): string | null => {
  const current = short?.trim();
  const original = source.shortDescription?.trim();
  if (!authenticatedOrigin || !sameEditorialUnit(source, prepared) ||
    !current || !original || !source.model || !source.title || !prepared.title ||
    !source.title.includes(source.model) || !prepared.title.includes(source.model) ||
    source.specs?.Modelo !== prepared.specs?.Modelo ||
    typeof source.specs?.Modelo !== "string" || source.specs.Modelo !== source.model ||
    wordCount(current) <= 45 || wordCount(current) > 120 ||
    original !== current || /https?:\/\/|<[^>]+>|@/u.test(current)) return null;
  const capacity = editorialQuantityOf(source.specs, ["Capacidad de carga (kg)"], "kg");
  if (capacity === null || capacity !== editorialQuantityOf(prepared.specs, ["Capacidad de carga (kg)"], "kg") ||
    capacity < 100 || capacity > 100000) return null;
  const tonnage = /\bhasta\s+(\d{1,3})\s+toneladas\b/iu.exec(original)?.[1];
  if (tonnage && Number(tonnage) * 1000 !== capacity && Number(tonnage) >= 1) {
    return `${prepared.title}. La tabla técnica indica ${formatEditorialQuantity(capacity)} kg de capacidad, mientras que la descripción comercial anuncia ${tonnage} toneladas. Las cifras deben contrastarse antes de atribuir esa capacidad a la unidad.`;
  }
  const motorAlternatives = typeof source.specs?.["Tipo motor"] === "string" &&
    source.specs["Tipo motor"] === prepared.specs?.["Tipo motor"] &&
    /\bdi[eé]sel\s+o\s+GLP\b/iu.test(source.specs["Tipo motor"]);
  if (motorAlternatives && /\b(?:di[eé]sel|gas[oó]leo)\b/iu.test(original) && /\bGLP\b/iu.test(original)) {
    return `${prepared.title}. Capacidad técnica: ${formatEditorialQuantity(capacity)} kg; el origen menciona versiones diésel o GLP. La motorización y los accesorios de la unidad ofertada deben confirmarse.`;
  }
  const originalGeneral = source.longDescription ?? "";
  const contradictoryCapacity = [...originalGeneral.matchAll(/\bcapacidad de carga de\s+(\d{2,5})\s*kg\b/giu)]
    .some((match) => Number(match[1]) !== capacity);
  if (contradictoryCapacity && /\bh[ií]brid[oa]\b/iu.test(original) &&
    /\bcapacidad de carga de\s*\d{2,5}\s*kg\b/iu.test(original)) {
    return `${prepared.title}. La ficha técnica declara ${formatEditorialQuantity(capacity)} kg de capacidad. La descripción extensa del proveedor contiene una cifra distinta, por lo que las prestaciones y la configuración deben contrastarse antes de su publicación.`;
  }
  return null;
};

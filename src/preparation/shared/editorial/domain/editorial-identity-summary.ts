import { containsEditorialBrandModel } from "./editorial-identity-match.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { EditorialFamily } from "./editorial-families.js";
import { editorialFamilyName, resolveConsistentEditorialFamily } from "./editorial-families.js";
import { resolveEditorialSource } from "./editorial-source.js";

export const resolveEditorialIdentitySummary = (
  record: ProductRecord,
  familyOverride: EditorialFamily | null
): string | null => {
  const source = resolveEditorialSource(record);
  if (!source) return null;
  const family = resolveConsistentEditorialFamily(source.familyClues, record.title,
    typeof record.specs?.["Título adicional"] === "string" ? record.specs["Título adicional"] : null,
    `${record.subcategory ?? ""} | ${record.categoryName}`, familyOverride);
  if (!family) return null;
  const noun = editorialFamilyName(family);
  const condition = record.condition === "Segunda mano" ? " de ocasión" : record.condition === "Nuevo" ? " nueva" : "";
  return `${noun[0]?.toLocaleUpperCase("es") ?? ""}${noun.slice(1)} ${source.brand} ${source.model}${condition}.`;
};

export const conciseVerifiedUnitGeneral = (record: ProductRecord, general: string): string | null => {
  const first = general.trim().split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/u)[0] ?? "";
  if (!record.brand || !record.model || first.length < 35 || first.length > 180 ||
    !containsEditorialBrandModel(first, record.brand, record.model)) return null;
  return first;
};

export const conciseSignedUnitGeneral = (general: string): string | null => {
  const first = general.trim().split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/u)[0] ?? "";
  if (first.length < 45 || first.length > 220 || !/[.!?]$/u.test(first) ||
    /^(?:contamos|tenemos|ofrecemos|disponemos)\b/iu.test(first)) return null;
  return first;
};

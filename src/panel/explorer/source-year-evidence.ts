import type { ProductRecord } from "../../contracts/catalog.js";
import { explicitGamTitleYear, gamUrlYear } from "../../catalog/normalization/gam/year.js";
import { normalizeSpecKey } from "../../catalog/normalization/normalize-specs.js";

type SourceYearEvidence = {
  readonly sourceField: "year" | "url" | "longDescription";
  readonly sourceValue: string;
  readonly mechanism: string | null;
};

export { isGamUnitUrl } from "../../catalog/normalization/gam/unit-url.js";
import { isGamUnitUrl } from "../../catalog/normalization/gam/unit-url.js";

export const sourceYearEvidence = (
  original: ProductRecord, field: string, value: string | null
): SourceYearEvidence | null => {
  if (field !== normalizeSpecKey("Año de fabricación") || value === null ||
    !/^(?:19|20)\d{2}$/u.test(value) || original.year?.trim() !== value ||
    Object.keys(original.specs ?? {}).some((key) => normalizeSpecKey(key) === field)) return null;
  if (original.yearSource === "ficha") {
    return { sourceField: "year", sourceValue: value, mechanism: null };
  }
  if (original.providerId !== "gam") return null;
  const urlYear = gamUrlYear(original.url, original.reference);
  if ((original.yearSource === "url" || original.yearSource === "descripcion") && urlYear === value) {
    return { sourceField: "url", sourceValue: original.url,
      mechanism: "src/catalog/normalization/gam/year.ts" };
  }
  if (original.yearSource === "descripcion" && urlYear === null && isGamUnitUrl(original) && original.longDescription &&
    explicitGamTitleYear(original.longDescription) === value &&
    (original.longDescription.match(/\b(?:19|20)\d{2}\b/gu) ?? []).length === 1) {
    return { sourceField: "longDescription", sourceValue: original.longDescription,
      mechanism: "src/catalog/normalization/gam/year.ts" };
  }
  return null;
};

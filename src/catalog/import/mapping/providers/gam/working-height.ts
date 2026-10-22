import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold, numberToken } from "../../attribute-utils.js";

const workingHeightPatterns = [
  /\baltura\s+(?:maxima\s+)?de\s+trabajo(?:\s+maxima)?\s*(?:[:=-]\s*)?(?:(?:es\s+)?de\s+)?(?:hasta\s+)?(\d+(?:[.,]\d{1,2})?)\s*(mm|cm|m|metros?)\b/g,
  /\b(\d+(?:[.,]\d{1,2})?)\s*(mm|cm|m|metros?)\s+de\s+altura\s+(?:maxima\s+)?de\s+trabajo\b/g,
  /\b(?:permite\s+)?trabajar\s+a\s+una\s+altura\s+maxima\s+de\s+(\d+(?:[.,]\d{1,2})?)\s*(mm|cm|m|metros?)\b/g
] as const;

const questionHeightPattern = /\baltura\s+(?:maxima\s+)?de\s+trabajo\s*\?\s*(?:hasta\s+)?(\d+(?:[.,]\d{1,2})?)\s*(mm|cm|m|metros?)\b/g;
const additionalMaximumPattern = /\baltura\s+maxima\s+de\s+(\d+(?:[.,]\d{1,2})?)\s*(mm|cm|m|metros?)\b/g;

const measurement = (raw: string, unit: string): number | null => {
  const number = numberToken(raw);
  if (number === null || number <= 0) return null;
  const meters = number * (unit === "mm" ? 0.001 : unit === "cm" ? 0.01 : 1);
  return Number.isFinite(meters) && meters > 0 ? Math.round(meters * 1000) / 1000 : null;
};

const ambiguousAlternative = (text: string): boolean => {
  const alternative = text.match(/^\s*(?:[,/-]\s*|(?:o|u|y|hasta)\s+)(\d+(?:[.,]\d{1,2})?)\s*(?:mm|cm|m|metros?)\b/);
  if (!alternative) return false;
  const remainder = text.slice(alternative[0].length);
  return !/^\s+de\s+(?:altura\s+(?:de\s+)?(?:plataforma|cesta|elevacion)|alcance(?:\s+(?:horizontal|lateral))?|capacidad)\b/.test(remainder);
};

const questionMatchesIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !["elevacion", "elevacion-nueva"].includes(record.categoryKey) ||
    !record.model || !record.title || !record.shortDescription || !record.longDescription) return false;
  const exactModel = fold(record.model);
  const baseModel = exactModel.replace(/-li$/, "");
  if (baseModel.length < 5 || !/\d/.test(baseModel)) return false;
  return fold(record.shortDescription).includes(exactModel) &&
    fold(record.title).includes(baseModel) && fold(record.longDescription).includes(baseModel);
};

export const gamWorkingHeightFromDescription = (record: ProductRecord): number | null => {
  const descriptions = [record.shortDescription, record.longDescription].filter((value): value is string => Boolean(value?.trim()));
  const values: number[] = [];
  for (const description of descriptions) {
    const text = fold(description);
    for (const pattern of workingHeightPatterns) {
      for (const match of text.matchAll(pattern)) {
        const value = match[1] && match[2] ? measurement(match[1], match[2]) : null;
        if (value === null || ambiguousAlternative(text.slice((match.index ?? 0) + match[0].length))) return null;
        values.push(value);
      }
    }
  }
  if (questionMatchesIdentity(record)) {
    for (const match of fold(record.longDescription ?? "").matchAll(questionHeightPattern)) {
      const value = match[1] && match[2] ? measurement(match[1], match[2]) : null;
      if (value === null) return null;
      values.push(value);
    }
  }
  if (values.length === 0) return null;
  const first = values[0];
  if (first === undefined || values.some((value) => value !== first)) return null;
  for (const description of descriptions) {
    const text = fold(description);
    for (const match of text.matchAll(additionalMaximumPattern)) {
      const value = match[1] && match[2] ? measurement(match[1], match[2]) : null;
      if (value !== null && value !== first) return null;
    }
  }
  return first;
};

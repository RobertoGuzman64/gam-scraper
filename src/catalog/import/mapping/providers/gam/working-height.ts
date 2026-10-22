import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../attribute-utils.js";

const workingHeightPatterns = [
  /\baltura\s+(?:maxima\s+)?de\s+trabajo(?:\s+maxima)?\s*(?:[:=-]\s*)?(?:de\s+)?(\d+(?:[.,]\d{1,2})?)\s*(?:m|metros?)\b/g,
  /\b(\d+(?:[.,]\d{1,2})?)\s*(?:m|metros?)\s+de\s+altura\s+(?:maxima\s+)?de\s+trabajo\b/g
] as const;

const questionHeightPattern = /\baltura\s+(?:maxima\s+)?de\s+trabajo\s*\?\s*(?:hasta\s+)?(\d+(?:[.,]\d{1,2})?)\s*(?:m|metros?)\b/g;

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
        const raw = match[1];
        if (!raw) continue;
        const value = Number(raw.replace(",", "."));
        if (!Number.isFinite(value) || value <= 0) return null;
        values.push(value);
      }
    }
  }
  if (questionMatchesIdentity(record)) {
    for (const match of fold(record.longDescription ?? "").matchAll(questionHeightPattern)) {
      const raw = match[1];
      if (!raw) continue;
      const value = Number(raw.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0 || value > 65) return null;
      values.push(value);
    }
  }
  if (values.length === 0) return null;
  const first = values[0];
  return first !== undefined && values.every((value) => value === first) ? first : null;
};

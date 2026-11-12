import type { SpecValue, SpecsMap } from "../../../../contracts/catalog.js";

export type EditorialQuantity = "m" | "mm" | "kg" | "t" | "V" | "kW" | "kVA" | "%" | "h" | "N";

const numberPattern = /^(\d+(?:[.,]\d{1,3})?|\d{1,3}(?:[. ]\d{3})+(?:,\d{1,3})?)$/u;

const parseNumber = (value: string): number | null => {
  if (!numberPattern.test(value)) return null;
  const normalized = /\d[. ]\d{3}(?:\D|$)/u.test(value) ? value.replace(/[. ]/gu, "").replace(",", ".") : value.replace(",", ".");
  const result = Number(normalized);
  return Number.isFinite(result) && result > 0 ? result : null;
};

export const editorialQuantity = (raw: SpecValue | undefined, unit: EditorialQuantity): number | null => {
  if (typeof raw !== "string") return null;
  const match = /^([\d., ]+)\s*(mm|kg|kva|kw|n|metros?|m|t|v|%|h|horas?)$/iu.exec(raw.trim());
  if (!match?.[1] || !match[2]) return null;
  const sourceUnit = match[2].toLowerCase();
  const targetUnit = unit.toLowerCase();
  if (sourceUnit !== targetUnit && !(targetUnit === "h" && sourceUnit.startsWith("hora")) &&
    !(targetUnit === "m" && sourceUnit.startsWith("metro"))) return null;
  return parseNumber(match[1].trim());
};

export const editorialQuantityOf = (specs: SpecsMap | undefined, keys: readonly string[], unit: EditorialQuantity): number | null => {
  for (const key of keys) {
    const value = specs?.[key];
    if (value === undefined) continue;
    return editorialQuantity(value, unit);
  }
  return null;
};

export const editorialMetricOf = (specs: SpecsMap | undefined, keys: readonly string[]): number | null => {
  for (const key of keys) {
    const value = specs?.[key];
    if (value === undefined) continue;
    const meters = editorialQuantity(value, "m");
    if (meters !== null) return meters;
    const millimeters = editorialQuantity(value, "mm");
    return millimeters === null ? null : millimeters / 1000;
  }
  return null;
};

export const formatEditorialQuantity = (value: number): string => {
  const [whole, fraction] = value.toFixed(3).split(".");
  const formatted = (whole ?? "").replace(/\B(?=(\d{3})+(?!\d))/gu, ".");
  const decimals = (fraction ?? "").replace(/0+$/u, "");
  return decimals ? `${formatted},${decimals}` : formatted;
};

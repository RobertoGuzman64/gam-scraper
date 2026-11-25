import type { ProductRecord, SpecValue } from "../../../../contracts/catalog.js";
import { editorialMetricOf, editorialQuantity, formatEditorialQuantity } from "../../measurements/editorial-measurements.js";

export const equalSpec = (source: ProductRecord, prepared: ProductRecord, key: string): string | null => {
  const raw = source.specs?.[key];
  return typeof raw === "string" && raw.trim() && raw === prepared.specs?.[key] ? raw.trim() : null;
};

export const metres = (source: ProductRecord, prepared: ProductRecord, key: string, min: number, max: number): string | null => {
  if (!equalSpec(source, prepared, key)) return null;
  const value = editorialMetricOf(source.specs, [key]);
  return value !== null && value >= min && value <= max && value === editorialMetricOf(prepared.specs, [key]) ?
    `${formatEditorialQuantity(value)} m` : null;
};

export const quantity = (source: ProductRecord, prepared: ProductRecord, key: string,
  unit: "mm" | "kW", min: number, max: number): string | null => {
  const raw = equalSpec(source, prepared, key);
  const value = editorialQuantity(raw ?? undefined, unit);
  return value !== null && value >= min && value <= max ? `${formatEditorialQuantity(value)} ${unit}` : null;
};

export const declaredBoolean = (value: SpecValue | undefined): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  if (/^(?:s[ií]|yes)$/iu.test(value.trim())) return true;
  if (/^no$/iu.test(value.trim())) return false;
  return null;
};

export const affirmativeSpecs = (record: ProductRecord, keys: readonly string[]): boolean => {
  const values = keys.flatMap((key) => {
    const value = record.specs?.[key];
    return value === undefined ? [] : [declaredBoolean(value)];
  });
  return values.length > 0 && values.every((value) => value === true);
};

export const matchingMetric = (source: ProductRecord, prepared: ProductRecord, keys: readonly string[]): number | null => {
  const original = editorialMetricOf(source.specs, keys);
  return original !== null && original === editorialMetricOf(prepared.specs, keys) ? original : null;
};

export const declaredConfiguration = (
  source: ProductRecord, prepared: ProductRecord, keys: readonly string[],
  parse: (value: string) => string | null
): string | null => {
  const values = keys.flatMap((key) => {
    if (source.specs?.[key] === undefined && prepared.specs?.[key] === undefined) return [];
    const raw = equalSpec(source, prepared, key);
    return [raw === null ? null : parse(raw.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es"))];
  });
  const first = values[0];
  return first && values.every((value) => value === first) ? first : null;
};

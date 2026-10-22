import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold, numberToken, scalar } from "../../attribute-utils.js";

const elevationRecord = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !["elevacion", "elevacion-nueva"].includes(record.categoryKey)) return false;
  try {
    const url = new URL(record.url);
    if (url.hostname !== "online.gamrentals.com" || url.pathname.split("/").filter(Boolean)[0] !== "es") return false;
  } catch {
    return false;
  }
  const title = fold(record.title ?? "");
  if (!/\b(?:plataformas?|elevadores?|camiones? cesta)\b/.test(title)) return false;
  const identification = fold(`${record.title ?? ""} ${record.shortDescription ?? ""}`).replace(/[^a-z0-9]/g, "");
  for (const value of [record.brand, record.model]) {
    if (value && !identification.includes(fold(value).replace(/[^a-z0-9]/g, ""))) return false;
  }
  return true;
};

const descriptions = (record: ProductRecord): readonly string[] =>
  [record.shortDescription, record.longDescription].filter((value): value is string => Boolean(value?.trim()));

const valueInMeters = (raw: string, unit: string): number | null => {
  const parsed = numberToken(raw);
  if (parsed === null) return null;
  const result = parsed * (unit === "mm" ? 0.001 : unit === "cm" ? 0.01 : 1);
  return Number.isFinite(result) && result > 0 && result <= 65 ? Math.round(result * 1000) / 1000 : null;
};

const singleMeasurement = (record: ProductRecord, patterns: readonly RegExp[]): number | null => {
  const values = new Set<number>();
  for (const part of descriptions(record)) {
    const text = fold(part);
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const value = match[1] && match[2] ? valueInMeters(match[1], match[2]) : null;
        if (value === null) return null;
        const suffix = text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 45);
        if (/^(?:\s*[/,-]\s*|\s+(?:o|u|y|hasta)\s+)\d[\d.,]*/.test(suffix)) return null;
        values.add(value);
      }
    }
  }
  return values.size === 1 ? [...values][0] ?? null : null;
};

const basketCapacity = (record: ProductRecord): number | null => {
  if (!descriptions(record).some((part) => /\bcapacidad\s+(?:maxima\s+|nominal\s+)?(?:de\s+)?(?:la\s+)?cesta\b/.test(fold(part)))) return null;
  const capacities = new Set<number>();
  for (const part of descriptions(record)) {
    const text = fold(part);
    if (/\b(?:sin|con) restriccion\b/.test(text) && /\bcapacidad\b/.test(text)) return null;
    for (const match of text.matchAll(/\bcapacidad\s+(?:maxima\s+|nominal\s+)?(?:de\s+)?(?:la\s+)?(?:cesta|carga)\s*(?:de\s+|: ?|hasta\s+)?(\d[\d.,]*)\s*(kg|kilogramos?)\b/g)) {
      const value = match[1] ? numberToken(match[1]) : null;
      if (value === null || value <= 0 || value > 1500) return null;
      capacities.add(value);
    }
  }
  const rawSpec = record.specs?.["Capacidad de carga (kg)"];
  const spec = rawSpec === undefined ? null : scalar(rawSpec);
  if (spec !== null) {
    const value = typeof spec === "number" ? spec : typeof spec === "string" ? numberToken(spec.replace(/\s*(?:kg|kilogramos?)\s*$/i, "")) : null;
    if (value === null || value <= 0 || value > 1500) return null;
    capacities.add(value);
  }
  return capacities.size === 1 ? [...capacities][0] ?? null : null;
};

const traction = (record: ProductRecord): string | null => {
  const text = fold(`${record.title ?? ""} ${record.shortDescription ?? ""}`);
  const tracked = /\borugas\b/.test(text);
  const truck = /\b(?:sobre\s+camion|montad[oa]\s+sobre\s+camion)\b/.test(text);
  if (tracked === truck) return null;
  return tracked ? "Orugas" : "Sobre camión";
};

export const gamElevationCandidate = (record: ProductRecord, attribute: Attribute): Candidate | null => {
  if (!elevationRecord(record)) return null;
  let value: string | number | null = null;
  if (attribute.type === "NUMBER" && attribute.unit_option === "m") {
    if (attribute.name === "Altura de plataforma") value = singleMeasurement(record, [
      /\baltura\s+de\s+(?:la\s+)?plataforma\s+(?:de\s+)?(\d+(?:[.,]\d{1,2})?)\s*(mm|cm|m|metros?)\b/g,
      /\b(\d+(?:[.,]\d{1,2})?)\s*(mm|cm|m|metros?)\s+de\s+altura\s+de\s+(?:la\s+)?plataforma\b/g
    ]);
    if (attribute.name === "Alcance horizontal") value = singleMeasurement(record, [
      /\balcance\s+horizontal\s+(?:maximo\s*)?(?:de\s+)?(?:hasta\s+)?[:=]?\s*(\d+(?:[.,]\d{1,2})?)\s*(mm|cm|m|metros?)\b/g,
      /\b(\d+(?:[.,]\d{1,2})?)\s*(mm|cm|m|metros?)\s+de\s+alcance\s+horizontal\b/g
    ]);
  }
  if (attribute.name === "Capacidad de la cesta" && attribute.type === "NUMBER" && attribute.unit_option === "kg") {
    value = basketCapacity(record);
  }
  if (attribute.name === "Tipo de tracción" && attribute.type === "SELECT") value = traction(record);
  return value === null ? null : { key: attribute.name, value };
};

export const gamElevationHeightConflicts = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !["elevacion", "elevacion-nueva"].includes(record.categoryKey)) return false;
  const source = record.specs?.["Altura de elevación (m)"];
  const raw = source === undefined ? null : scalar(source);
  if (typeof raw !== "string") return false;
  const matched = raw.trim().match(/^(\d[\d.,]*)\s*(mm|cm|m|metros?)$/i);
  const declared = matched?.[1] && matched[2] ? valueInMeters(matched[1], fold(matched[2])) : null;
  if (declared === null) return false;
  for (const part of descriptions(record)) {
    for (const match of fold(part).matchAll(/\baltura\s+de\s+elevacion\s+(?:impresionante\s+)?(?:de\s+)?(?:hasta\s+)?(\d[\d.,]*)\s*(mm|cm|m|metros?)\b/g)) {
      const described = match[1] && match[2] ? valueInMeters(match[1], match[2]) : null;
      if (described !== null && described !== declared) return true;
    }
  }
  return false;
};

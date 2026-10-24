import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold, numberToken, scalar } from "../../attribute-utils.js";
import { validMercaelevaTechnicalSource } from "./technical.js";

const quantity = String.raw`(\d{1,3}(?:[. ]\d{3})+|\d+(?:[.,]\d{1,2})?)`;

type Measurement = { value: number; ambiguous: boolean };

const measurements = (text: string, expression: RegExp, unit: "kg" | "mm"): readonly Measurement[] => {
  const results: Measurement[] = [];
  for (const match of text.matchAll(expression)) {
    const amount = match[1];
    const sourceUnit = match[2]?.toLocaleLowerCase("es");
    if (!amount || !sourceUnit) continue;
    const parsed = numberToken(amount);
    if (parsed === null || parsed <= 0) continue;
    const value = unit === "mm" && sourceUnit === "m" ? parsed * 1000 : parsed;
    const rest = text.slice((match.index ?? 0) + match[0].length);
    results.push({ value, ambiguous: /^\s*(?:\/|o\b|u\b|a\b|y\b|[-–])\s*\d/i.test(rest) });
  }
  return results;
};

const mastTypes = (text: string): Set<string> => {
  const types = new Set<string>();
  const normalized = fold(text);
  for (const match of normalized.matchAll(/\b(?:cuadruplex|triplex|duplex|simplex)\b/g)) {
    types.add(match[0]);
  }
  for (const match of normalized.matchAll(/\bmastil\s+(?:tipo\s+)?(triple|doble|simple)\b/g)) {
    const type = match[1];
    if (type === "triple") types.add("triplex");
    if (type === "doble") types.add("duplex");
    if (type === "simple") types.add("simplex");
  }
  return types;
};

const publishedMast = (record: ProductRecord): string | null => {
  const value = record.specs?.["Tipo de mástil"];
  const published = value === undefined ? null : scalar(value);
  if (typeof published !== "string") return null;
  const normalized = fold(published);
  if (/^(?:triple|triplex)$/.test(normalized)) return "triplex";
  if (/^(?:duplex|duplex\/estandar|doble)$/.test(normalized)) return "duplex";
  if (/^(?:simple|simplex)$/.test(normalized)) return "simplex";
  if (normalized === "cuadruplex") return "cuadruplex";
  return null;
};

const sourceMeasurements = (record: ProductRecord, attribute: Attribute): readonly Measurement[] => {
  const text = fold(record.longDescription ?? "");
  const title = fold(record.title ?? "");
  const additional = fold(String(record.specs?.["Título adicional"] ?? ""));
  const family = `${title} ${additional}`;
  if (attribute.name === "Capacidad de carga" && attribute.type === "NUMBER" && attribute.unit_option === "kg") {
    if (!/\b(?:carretilla|apilador|transpalet(?:a)?)\b/.test(family)) return [];
    return measurements(text, new RegExp(String.raw`\bcapacidad\s+(?:de\s+carga|nominal)\s*:?\s*${quantity}\s*(kg)\b`, "g"), "kg");
  }
  if (attribute.name === "Altura de elevación" && attribute.type === "NUMBER" && attribute.unit_option === "mm") {
    if (!/\b(?:carretilla|apilador)\b/.test(family)) return [];
    return measurements(text, new RegExp(String.raw`\baltura\s+(?:(?:maxima\s+)?de\s+)?elevacion\s*:?\s*${quantity}\s*(mm|m)\b`, "g"), "mm");
  }
  if (attribute.name === "Peso operativo" && attribute.type === "NUMBER" && attribute.unit_option === "kg") {
    if (!/\b(?:dumper|miniexcavadora|excavadora)\b/.test(family)) return [];
    return measurements(text, new RegExp(String.raw`\bpeso\s+(?:operativo|en\s+servicio)\s*:?\s*${quantity}\s*(kg)\b`, "g"), "kg");
  }
  return [];
};

const singleKilogramAmount = (text: string): number | null => {
  const matches = [...fold(text).matchAll(/\b(\d{1,3}(?:[. ]\d{3})+|\d{3,5})\s*kg\b/g)];
  return matches.length === 1 && matches[0]?.[1] ? numberToken(matches[0][1]) : null;
};

export const mercaelevaMislabelledCapacity = (record: ProductRecord): boolean => {
  if (!validMercaelevaTechnicalSource(record)) return false;
  const title = fold(record.title ?? "");
  const additional = record.specs?.["Título adicional"];
  const description = fold(record.longDescription ?? "");
  if (typeof additional !== "string" || !/\bcarretilla\b/.test(title) ||
    !/\bcarretilla\b/.test(fold(additional)) || !/\bcarretilla\b/.test(description)) return false;
  if (!record.brand?.trim() || !record.model?.trim() ||
    !title.includes(fold(record.brand)) || !title.includes(fold(record.model)) ||
    !description.includes(fold(record.brand)) || !description.includes(fold(record.model))) return false;
  const titleLoad = singleKilogramAmount(title);
  if (titleLoad === null || titleLoad <= 0 ||
    singleKilogramAmount(additional) !== titleLoad || singleKilogramAmount(description) !== titleLoad) return false;
  if (record.shortDescription?.trim() && singleKilogramAmount(record.shortDescription) !== titleLoad) return false;
  const sourceCapacity = record.specs?.["Capacidad máxima de elevación"];
  if (typeof sourceCapacity !== "string") return false;
  const specification = /^(\d{1,3}(?:[. ]\d{3})+|\d{3,5})\s*kg$/i.exec(sourceCapacity.trim());
  if (!specification?.[1]) return false;
  const publishedLoad = numberToken(specification[1]);
  if (publishedLoad === null || publishedLoad === titleLoad) return false;
  const heights = [...description.matchAll(/\baltura\s+(?:de\s+)?(?:trabajo|elevacion)\s*:?\s*(\d{1,3}(?:[. ]\d{3})+|\d{3,5})\s*mm\b/g)];
  if (heights.length !== 1 || !heights[0]?.[1] || numberToken(heights[0][1]) !== publishedLoad) return false;
  const declaredHeight = record.specs?.["Altura máxima de elevación"];
  if (declaredHeight !== undefined) {
    if (typeof declaredHeight !== "string") return false;
    const parsed = /^(\d{1,3}(?:[. ]\d{3})+|\d{3,5})\s*mm$/i.exec(declaredHeight.trim());
    if (!parsed?.[1] || numberToken(parsed[1]) !== publishedLoad) return false;
  }
  return true;
};

export const mercaelevaUnspecifiedMast = (record: ProductRecord): boolean => {
  if (!validMercaelevaTechnicalSource(record) || !record.model || !record.brand) return false;
  const title = fold(record.title ?? "");
  const description = fold(record.longDescription ?? "");
  const additional = fold(String(record.specs?.["Título adicional"] ?? ""));
  const identity = [fold(record.brand), fold(record.model)];
  if (!/\bcarretilla\b/.test(title) || !/\bcarretilla\b/.test(additional) ||
    !identity.every((part) => title.includes(part) && description.includes(part))) return false;
  const declared = publishedMast(record);
  if (declared === null || !mastTypes(description).has(declared)) return false;
  const indicated = mastTypes(description);
  if (indicated.size !== 2 || !description.includes("duplex triplex")) return false;
  return indicated.has("duplex") && indicated.has("triplex") &&
    !/\bmastil\s+(?:instalado|montado|equipado)\s+(?:es|de|tipo)?\s*(?:duplex|triplex)\b/.test(description);
};

export const mercaelevaHandlingEvidence = (
  record: ProductRecord, attribute: Attribute
): { safe: true; candidate: Candidate | null } | { safe: false; candidate: null; reason: "contradiction" | "rejected" } => {
  if (!validMercaelevaTechnicalSource(record)) return { safe: true, candidate: null };
  if (attribute.name === "Tipo de mástil" && /\bcarretilla\b/.test(fold(`${record.title ?? ""} ${String(record.specs?.["Título adicional"] ?? "")}`))) {
    const described = mastTypes(record.longDescription ?? "");
    const declared = publishedMast(record);
    if (described.size > 1 || (declared !== null && described.size === 1 && !described.has(declared))) {
      return { safe: false, candidate: null, reason: "contradiction" };
    }
  }
  const found = sourceMeasurements(record, attribute);
  if (found.length === 0) return { safe: true, candidate: null };
  if (found.some((item) => item.value !== found[0]?.value)) {
    return { safe: false, candidate: null, reason: "contradiction" };
  }
  if (found.some((item) => item.ambiguous)) {
    return { safe: false, candidate: null, reason: "rejected" };
  }
  const first = found[0];
  return { safe: true, candidate: first ? { key: attribute.name, value: first.value } : null };
};

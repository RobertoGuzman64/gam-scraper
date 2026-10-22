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

export const mercaelevaHandlingEvidence = (
  record: ProductRecord, attribute: Attribute
): { safe: boolean; candidate: Candidate | null } => {
  if (!validMercaelevaTechnicalSource(record)) return { safe: true, candidate: null };
  if (attribute.name === "Tipo de mástil" && /\bcarretilla\b/.test(fold(`${record.title ?? ""} ${String(record.specs?.["Título adicional"] ?? "")}`))) {
    const described = mastTypes(record.longDescription ?? "");
    const declared = publishedMast(record);
    if (described.size > 1 || (declared !== null && described.size === 1 && !described.has(declared))) {
      return { safe: false, candidate: null };
    }
  }
  const found = sourceMeasurements(record, attribute);
  if (found.length === 0) return { safe: true, candidate: null };
  if (found.some((item) => item.ambiguous || item.value !== found[0]?.value)) {
    return { safe: false, candidate: null };
  }
  const first = found[0];
  return { safe: true, candidate: first ? { key: attribute.name, value: first.value } : null };
};

import type { ProductRecord, SpecValue } from "../../../../../contracts/catalog.js";
import type { Attribute } from "../../attribute-types.js";
import { fold, numberToken, scalar } from "../../attribute-utils.js";
import { gamHandlingModelEvidence, normalizeGamMast, relevantGamHandlingRecord } from "./handling.js";

const heightSpec = (value: SpecValue | undefined, defaultUnit: "mm" | "m"): number | null => {
  if (value === undefined) return null;
  const item = scalar(value);
  if (typeof item === "number") {
    const millimeters = item * (defaultUnit === "m" ? 1000 : 1);
    return Number.isFinite(millimeters) && millimeters >= 100 && millimeters <= 16000 ? millimeters : null;
  }
  if (typeof item !== "string") return null;
  const match = item.trim().match(/^(\d[\d.,]*)\s*(mm|cm|m|metros?)?$/i);
  if (!match?.[1]) return null;
  const quantity = numberToken(match[1]);
  if (quantity === null) return null;
  const unit = fold(match[2] ?? defaultUnit);
  const millimeters = quantity * (unit === "mm" ? 1 : unit === "cm" ? 10 : 1000);
  return millimeters >= 100 && millimeters <= 16000 ? millimeters : null;
};

const declaredHeight = (record: ProductRecord): number | null => {
  const specs = record.specs ?? {};
  const readings = [
    heightSpec(specs["Altura de elevación (mm)"], "mm"),
    heightSpec(specs["Altura Elevación (Industr.)"], "mm"),
    heightSpec(specs["Altura de elevación (m)"], "m")
  ].filter((value): value is number => value !== null);
  return readings.length > 0 && readings.every((value) => value === readings[0]) ? readings[0] ?? null : null;
};

const conflictingHeight = (record: ProductRecord): boolean => {
  const expected = declaredHeight(record);
  if (expected === null) return false;
  for (const paragraph of [record.shortDescription, record.longDescription]) {
    if (!paragraph || !gamHandlingModelEvidence(record, paragraph)) continue;
    const text = fold(paragraph);
    for (const match of text.matchAll(/\baltura\s+(?:maxima\s+)?de\s+elevacion\s+(?:de\s+)?(hasta\s+)?(\d[\d.,]*)\s*(mm|cm|m|metros?)\b/g)) {
      if (match[1] || !match[2] || !match[3]) continue;
      const tail = text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 85);
      const before = text.slice(Math.max(0, (match.index ?? 0) - 40), match.index ?? 0);
      if (/\b(?:hasta|desde|entre|segun|dependiendo|configuraciones?|opciones?|versiones?|alcanzar|puede)\b/.test(before) || /\b(?:segun|opciones?|configuraciones?|versiones?|disponibles?)\b/.test(tail) ||
        /^(?:\s*[/,-]\s*|\s+(?:o|u|y|a)\s+)\d[\d.,]*/.test(tail)) continue;
      const number = numberToken(match[2]);
      if (number === null) continue;
      const unit = match[3];
      const actual = number * (unit === "mm" ? 1 : unit === "cm" ? 10 : 1000);
      if (actual < 100 || actual > 16000) continue;
      const precision = match[2].match(/[.,](\d{1,2})$/)?.[1]?.length ?? 0;
      const tolerance = unit === "mm" ? 0.5 : unit === "cm" ? 5 : (precision === 0 ? 500 : 1000 / 10 ** precision);
      if (Math.abs(actual - expected) > tolerance) return true;
    }
  }
  return false;
};

const capacity = (raw: string, unit: string): number | null => {
  const quantity = numberToken(raw);
  if (quantity === null) return null;
  const kilograms = quantity * (unit === "t" || unit.startsWith("tonelada") ? 1000 : 1);
  return kilograms >= 50 && kilograms <= 100000 ? kilograms : null;
};

const capacityMentions = (value: string): readonly number[] => {
  const text = fold(value);
  const matches = [...text.matchAll(/\bcapacidad\s+(?:nominal\s+)?(?:de\s+)?carga\s+(?:de\s+)?(hasta\s+)?(\d[\d.,]*)\s*(kg|kilogramos?|toneladas?|t)\b/g)];
  return matches.flatMap((match) => {
    const tail = text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 42);
    if (/^(?:\s*[/,-]\s*|\s+(?:o|u|y|a)\s+)\d[\d.,]*/.test(tail)) return [];
    const result = match[2] && match[3] ? capacity(match[2], match[3]) : null;
    return result === null ? [] : [result];
  });
};

const confirmedShortCapacity = (record: ProductRecord): number | null => {
  const description = record.shortDescription;
  if (!description || !gamHandlingModelEvidence(record, description)) return null;
  const text = fold(description);
  const values = new Set<number>();
  for (const match of text.matchAll(/\bcapacidad\s+(?:nominal\s+)?(?:de\s+)?carga\s+(?:de\s+)?(hasta\s+)?(\d[\d.,]*)\s*(kg|kilogramos?|toneladas?|t)\b/g)) {
    if (match[1] || !match[2] || !match[3]) continue;
    const tail = text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 45);
    if (/^(?:\s*[/,-]\s*|\s+(?:o|u|y|a|hasta)\s+)\d[\d.,]*/.test(tail)) return null;
    const reading = capacity(match[2], match[3]);
    if (reading !== null) values.add(reading);
  }
  return values.size === 1 ? [...values][0] ?? null : null;
};

const conflictingCapacity = (record: ProductRecord): boolean => {
  const raw = record.specs?.["Capacidad de carga (kg)"];
  const direct = raw === undefined ? null : scalar(raw);
  if (typeof direct !== "string" && typeof direct !== "number") return false;
  const declared = typeof direct === "string" ? direct.trim().match(/^(\d[\d.,]*)\s*(kg|kilogramos?)$/i) : null;
  const expected = typeof direct === "number" ? direct : declared?.[1] && declared[2] ? capacity(declared[1], fold(declared[2])) : null;
  if (expected === null) return false;
  const shortCapacity = confirmedShortCapacity(record);
  if (shortCapacity !== null && shortCapacity !== expected) return true;
  const sources: readonly (readonly number[])[] = [
    (() => {
      const title = fold(record.title ?? "");
      const titleMatch = /\b(?:carretilla\w*|apilador\w*|transpaleta\w*|preparapedidos|recogepedidos)\b.{0,58}?\b(\d[\d.,]*)\s*kg\b/.exec(title);
      const found = titleMatch?.[1] ? capacity(titleMatch[1], "kg") : null;
      return found === null ? [] : [found];
    })(),
    capacityMentions(record.shortDescription ?? ""),
    record.longDescription && gamHandlingModelEvidence(record, record.longDescription)
      ? capacityMentions(record.longDescription) : []
  ];
  const differing = new Map<number, number>();
  for (const source of sources) {
    for (const value of new Set(source)) {
      if (value !== expected) differing.set(value, (differing.get(value) ?? 0) + 1);
    }
  }
  return [...differing.values()].some((count) => count >= 2);
};

const conflictingMast = (record: ProductRecord): boolean => {
  const raw = record.specs?.["Tipo Mástil"];
  const direct = raw === undefined ? null : scalar(raw);
  const expected = normalizeGamMast(direct);
  if (expected === null) return false;
  for (const paragraph of [record.shortDescription, record.longDescription]) {
    if (!paragraph || !gamHandlingModelEvidence(record, paragraph)) continue;
    const text = fold(paragraph);
    if (/\b(?:opciones?|versiones?|configuraciones?|disponibles?)\b.{0,90}\bmastil/.test(text)) continue;
    const attached = [...text.matchAll(/\b(?:monta|incorpora|equipad[oa]\s+con|con)\s+(?:un\s+)?mastil\s+(?:(simple|duplex|triplex|cuadruplex)\b|de\s+([1-4])\s+etapas?\b)/g)];
    const stages: Readonly<Record<string, string>> = { "1": "Simple", "2": "Dúplex", "3": "Tríplex", "4": "Cuádruplex" };
    for (const match of attached) {
      const tail = text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 65);
      if (/\b(?:opciones?|versiones?|configuraciones?|disponibles?|a\s+elegir)\b/.test(tail)) continue;
      const described = match[1] ? normalizeGamMast(match[1]) : stages[match[2] ?? ""] ?? null;
      if (described !== expected) return true;
    }
  }
  return false;
};

export const gamHandlingAttributeConflicts = (record: ProductRecord, attribute: Attribute): boolean => {
  if (!relevantGamHandlingRecord(record)) return false;
  if (attribute.name === "Altura de elevación" && attribute.type === "NUMBER" && attribute.unit_option === "mm") return conflictingHeight(record);
  if (attribute.name === "Capacidad de carga" && attribute.type === "NUMBER" && attribute.unit_option === "kg") return conflictingCapacity(record);
  if (attribute.name === "Tipo de mástil" && attribute.type === "SELECT") return conflictingMast(record);
  return false;
};

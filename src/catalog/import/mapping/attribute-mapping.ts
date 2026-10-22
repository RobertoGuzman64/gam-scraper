import { SPEC_KEY_NORMALIZATION } from "../../normalization/spec-rules.js";
import type { ProductRecord, SpecScalar } from "../../../contracts/catalog.js";
import type { Attribute, Candidate } from "./attribute-types.js";
import { fold, scalar, numberToken } from "./attribute-utils.js";
import { applyGamAliases, convertGamCandidate } from "./providers/gam/attributes.js";
import { applyGomarizAliases, convertGomarizCandidate } from "./providers/gomariz/attributes.js";
import { applyMercaelevaAliases } from "./providers/mercaeleva/attributes.js";
import { normalizeMercaelevaCandidate } from "./providers/mercaeleva/technical.js";

const aliases: Readonly<Record<string, readonly string[]>> = {
  "Tipo de mástil": ["Tipo Mástil"],
  "Capacidad de carga": ["Capacidad de carga (kg)"],
  "Altura de elevación": ["Altura de elevación (mm)", "Altura de elevación (m)"],
  "Peso operativo": ["Peso (kg)"],
  "Altura de trabajo": ["Altura de trabajo (mm)", "Altura de trabajo (m)"],
  "Altura de plataforma": ["Altura plataforma", "Altura plataforma (mm)", "Altura plataforma (m)"],
  "Pendiente superable": ["Pendiente superable (%)"],
  "Ancho de trabajo": ["Anchura trabajo (mm)"],
  "Potencia": ["Potencia (kW)"],
  "Horas de uso": ["Horas (h)", "Horas laborales"],
  "Año de fabricación": ["Año"],
  "Tipo de motor": ["Tipo motor"]
};

const unitOf = (source: string): "mm" | "cm" | "m" | "kg" | "kw" | "h" | "%" | null => {
  const value = fold(source);
  if (["mm", "cm", "m", "metros", "metro", "kg", "kilogramos", "kilogramo", "kw", "h", "horas", "hora", "%"].includes(value)) {
    if (value.startsWith("metro") || value === "m") return "m";
    if (value.startsWith("kilo") || value === "kg") return "kg";
    if (value.startsWith("hora") || value === "h") return "h";
    return value as "mm" | "cm" | "kw" | "%";
  }
  return null;
};

const numberValue = (value: SpecScalar, sourceKey: string, attribute: Attribute): number | null => {
  if (typeof value === "boolean") return null;
  let parsed: number;
  let explicit: ReturnType<typeof unitOf> = null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    parsed = value;
  } else {
    const matched = value.trim().match(/^([\d.,\s\u00a0\u202f]+)\s*([a-záéíóú%]+)?$/i);
    if (!matched?.[1]) return null;
    const numeric = numberToken(matched[1]);
    if (numeric === null) return null;
    parsed = numeric;
    explicit = matched[2] ? unitOf(matched[2]) : null;
    if (matched[2] && !explicit) return null;
  }
  const keyUnitMatch = sourceKey.match(/\((mm|cm|m|kg|kw|h|%)\)/i)?.[1];
  const keyUnit = keyUnitMatch ? unitOf(keyUnitMatch) : null;
  if (explicit && keyUnit && explicit !== keyUnit) return null;
  const sourceUnit = explicit ?? keyUnit;
  const targetUnit = unitOf(attribute.unit_option);
  if (sourceUnit && targetUnit && sourceUnit !== targetUnit) {
    const ratios: Readonly<Record<string, number>> = { mm: 0.001, cm: 0.01, m: 1 };
    if (!(sourceUnit in ratios) || !(targetUnit in ratios)) return null;
    return parsed * (ratios[sourceUnit] ?? 0) / (ratios[targetUnit] ?? 1);
  }
  if (sourceUnit && !targetUnit && !(attribute.name === "Horas de uso" && sourceUnit === "h")) return null;
  return parsed;
};

const convert = (value: SpecScalar, key: string, attribute: Attribute): string | number | boolean | null => {
  if (attribute.type === "NUMBER" || attribute.type === "DECIMAL") return numberValue(value, key, attribute);
  if (attribute.type === "DATE" || attribute.type === "MULTISELECT") return null;
  if (attribute.type === "BOOLEAN") {
    if (typeof value === "boolean") return value;
    if (typeof value !== "string") return null;
    if (["si", "true", "yes"].includes(fold(value))) return true;
    if (["no", "false"].includes(fold(value))) return false;
    return null;
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  const text = String(value).trim();
  return text || null;
};

export const resolveAttributeValue = (record: ProductRecord, attribute: Attribute): string | number | boolean | null => {
  const keys = new Set([attribute.name, ...(aliases[attribute.name] ?? [])].map(fold));
  const candidates: Candidate[] = [];
  if (record.providerId === "gam" && !applyGamAliases(record, attribute, keys, candidates)) return null;
  if (record.providerId === "gomariz" && !applyGomarizAliases(record, attribute, keys, candidates)) return null;
  if (record.providerId === "mercaeleva" && !applyMercaelevaAliases(record, attribute, keys, candidates)) return null;
  for (const [rawKey, spec] of Object.entries(record.specs ?? {})) {
    const canonical = SPEC_KEY_NORMALIZATION[fold(rawKey)] ?? rawKey;
    if (!keys.has(fold(rawKey)) && !keys.has(fold(canonical))) continue;
    const value = scalar(spec);
    if (value !== null) candidates.push({ key: rawKey, value });
  }
  const extra: Readonly<Record<string, string | null>> = {
    "Marca": record.brand,
    "Modelo": record.model,
    "Año de fabricación": record.year,
    "Horas de uso": record.horometer,
    "Ubicación / Delegación": record.location
  };
  const direct = extra[attribute.name];
  if (direct?.trim()) candidates.push({ key: attribute.name, value: direct });
  if (candidates.length === 0) return null;
  const converted = candidates.map((candidate) => {
    const fallback = convert(candidate.value, candidate.key, attribute);
    if (record.providerId === "gam") return convertGamCandidate(attribute, candidate, fallback);
    if (record.providerId === "gomariz") return convertGomarizCandidate(record, attribute, candidate, fallback);
    if (record.providerId === "mercaeleva") return normalizeMercaelevaCandidate(attribute, candidate, fallback);
    return fallback;
  });
  if (converted.some((value) => value === null)) return null;
  const first = converted[0];
  return converted.every((value) => value === first) ? first ?? null : null;
};

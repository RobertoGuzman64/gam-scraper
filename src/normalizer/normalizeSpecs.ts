import { SPEC_KEY_NORMALIZATION, SPEC_RULES, type SpecRuleType } from "./specRules.js";
import {
  cleanEnum,
  parseBattery,
  parseBoolean,
  parseDimension,
  parseDimensionRect,
  parseNumber,
  parseNumberArray
} from "./specParsers.js";

export type NormalizedSpecValue =
  | string
  | number
  | boolean
  | readonly number[]
  | ReturnType<typeof parseDimension>
  | ReturnType<typeof parseDimensionRect>
  | ReturnType<typeof parseBattery>
  | null;

export type NormalizeResult = {
  readonly normalized: Readonly<Record<string, NormalizedSpecValue>>;
  readonly unknownKeys: ReadonlyArray<string>;
  readonly renamedKeys: ReadonlyArray<{ readonly from: string; readonly to: string }>;
  readonly droppedNullLikeKeys: ReadonlyArray<string>;
};

const cleanKeyBase = (str: string): string =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const normalizeKey = (key: string): string => {
  const base = cleanKeyBase(key);
  return SPEC_KEY_NORMALIZATION[base] ?? key.trim();
};

const isNullLike = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (!t) return true;
    if (t === "null" || t === "undefined") return true;
    if (t === "n/a" || t === "na" || t === "no aplica") return true;
    if (t === "-" || t === "—") return true;
  }
  return false;
};

const isInvalidStringValue = (v: string): boolean => {
  const t = v.toLowerCase();
  if (t.includes("(mm)") || t.includes("(kg)") || t.includes("(m)") || t.includes("(%)")) return true;
  if (t.includes("altura") || t.includes("carga") || t.includes("peso")) return true;
  for (const key of Object.keys(SPEC_RULES)) {
    if (t === key.toLowerCase()) return true;
  }
  return false;
};

const applyRule = (type: SpecRuleType, value: unknown): NormalizedSpecValue => {
  if (isNullLike(value)) return null;
  switch (type) {
    case "number":
      return parseNumber(value);
    case "number_array":
      return parseNumberArray(value);
    case "dimension":
      return parseDimension(value);
    case "dimension_rect":
      return parseDimensionRect(value);
    case "battery":
      return parseBattery(value);
    case "bool":
      return parseBoolean(value);
    case "enum":
      return cleanEnum(value);
    case "location":
      return typeof value === "string" ? value.trim() : null;
    case "string":
    default:
      return typeof value === "string" ? value.trim() : null;
  }
};

export const normalizeSpecsObject = (spec: unknown): NormalizeResult => {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    return { normalized: {}, unknownKeys: [], renamedKeys: [], droppedNullLikeKeys: [] };
  }

  const input = spec as Record<string, unknown>;
  const normalized: Record<string, NormalizedSpecValue> = {};
  const unknownKeys: string[] = [];
  const renamedKeys: { from: string; to: string }[] = [];
  const droppedNullLikeKeys: string[] = [];

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const normKey = normalizeKey(rawKey);
    if (rawKey.trim() !== normKey) renamedKeys.push({ from: rawKey, to: normKey });

    const rule = SPEC_RULES[normKey];
    if (!rule) {
      unknownKeys.push(normKey);
      continue;
    }

    if (isNullLike(rawValue)) {
      droppedNullLikeKeys.push(normKey);
      continue;
    }

    if (rule === "string" && typeof rawValue === "string" && isInvalidStringValue(rawValue)) continue;

    let value: unknown = rawValue;
    if (normKey === "Nº de serie") {
      const s = String(rawValue).trim();
      if (!s || isNullLike(s)) {
        droppedNullLikeKeys.push(normKey);
        continue;
      }
      value = s;
    }
    if (rule === "string" && Array.isArray(value)) {
      const s = value
        .filter((v): v is string => typeof v === "string")
        .filter((v) => !isInvalidStringValue(v))
        .join(" ")
        .trim();
      if (!s) continue;
      value = s;
    }

    const parsed = applyRule(rule, value);
    if (parsed === null) {
      droppedNullLikeKeys.push(normKey);
      continue;
    }
    normalized[normKey] = parsed;
  }

  const unknownUnique = Array.from(new Set(unknownKeys)).sort((a, b) => a.localeCompare(b, "es"));
  return { normalized, unknownKeys: unknownUnique, renamedKeys, droppedNullLikeKeys };
};

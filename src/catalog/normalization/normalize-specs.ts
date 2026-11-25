import { SPEC_KEY_NORMALIZATION, SPEC_LENGTH_UNITS, SPEC_MASS_UNITS, SPEC_RULES, type SpecRuleType } from "./spec-rules.js";
import {
  cleanEnum,
  parseBattery,
  parseBoolean,
  parseDimension,
  parseDimensionRect,
  parseMeasuredLength,
  parseNumber,
  parseNumberArray,
  parseYear
} from "./spec-parsers.js";

export type NormalizedSpecValue =
  | string
  | number
  | boolean
  | readonly number[]
  | ReturnType<typeof parseDimension>
  | ReturnType<typeof parseDimensionRect>
  | ReturnType<typeof parseBattery>
  | null;

export type DiscardReason = "null_like" | "invalid_value" | "unit_mismatch" | "conditional_value" | "alias_conflict";

export type DiscardedSpec = {
  readonly rawKey: string;
  readonly key: string;
  readonly value: unknown;
  readonly reason: DiscardReason;
};

export type NormalizeResult = {
  readonly normalized: Readonly<Record<string, NormalizedSpecValue>>;
  readonly unknownKeys: ReadonlyArray<string>;
  readonly renamedKeys: ReadonlyArray<{ readonly from: string; readonly to: string }>;
  readonly droppedNullLikeKeys: ReadonlyArray<string>;
  readonly conflictingKeys: ReadonlyArray<{ readonly key: string; readonly sources: readonly string[] }>;
  readonly discardedSpecs: ReadonlyArray<DiscardedSpec>;
};

const cleanKeyBase = (str: string): string =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const normalizeSpecKey = (key: string): string => {
  const base = cleanKeyBase(key);
  return Object.hasOwn(SPEC_KEY_NORMALIZATION, base) ? (SPEC_KEY_NORMALIZATION[base] ?? key.trim()) : key.trim();
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
  const key = normalizeSpecKey(v);
  if (Object.hasOwn(SPEC_RULES, key)) return true;
  const text = cleanKeyBase(v);
  return Object.keys(SPEC_RULES).some((candidate) => cleanKeyBase(candidate) === text);
};

const specUnit = (key: string): string | undefined =>
  key.match(/\(([^)]+)\)$/)?.[1] ?? (Object.hasOwn(SPEC_LENGTH_UNITS, key) ? SPEC_LENGTH_UNITS[key] : undefined) ??
  (Object.hasOwn(SPEC_MASS_UNITS, key) ? SPEC_MASS_UNITS[key] : undefined);

const rejectionReason = (value: unknown, key: string, rule: SpecRuleType): DiscardReason => {
  if (typeof value !== "string") return "invalid_value";
  const text = value.trim();
  if (/^[+-]?\d[\d.,]*\s*(?:[x×/]|[-–])\s*[+-]?\d/u.test(text)) return "conditional_value";
  const expectedUnit = specUnit(key);
  if (expectedUnit && (rule === "number" || rule === "number_array")) {
    const match = text.match(/^[+-]?\d[\d.,]*\s+([a-zA-Záéíóú²%/]+)$/iu);
    if (match?.[1] && parseNumber(text, expectedUnit) === null && parseMeasuredLength(text, key, expectedUnit === "m" ? "m" : "mm") === null) {
      return "unit_mismatch";
    }
  }
  return "invalid_value";
};

const applyRule = (type: SpecRuleType, value: unknown, rawKey: string, normalizedKey: string): NormalizedSpecValue => {
  if (isNullLike(value)) return null;
  switch (type) {
    case "number": {
      if (normalizedKey === "Año") return parseYear(value);
      const measure = specUnit(normalizedKey);
      if (measure === "mm" || measure === "m") return parseMeasuredLength(value, rawKey, measure);
      const unit = measure;
      const number = parseNumber(value, unit);
      return number !== null && number >= 0 ? number : null;
    }
    case "number_array": {
      const unit = normalizedKey.match(/\(([^)]+)\)$/)?.[1];
      const numbers = parseNumberArray(value, unit, normalizedKey === "Velocidad de desplazamiento con/sin carga (km/h)");
      return numbers?.every((number) => number >= 0) ? numbers : null;
    }
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
    return { normalized: {}, unknownKeys: [], renamedKeys: [], droppedNullLikeKeys: [], conflictingKeys: [], discardedSpecs: [] };
  }

  const input = spec as Record<string, unknown>;
  const normalized: Record<string, NormalizedSpecValue> = {};
  const unknownKeys: string[] = [];
  const renamedKeys: { from: string; to: string }[] = [];
  const droppedNullLikeKeys: string[] = [];
  const discardedSpecs: DiscardedSpec[] = [];
  const sources = new Map<string, string[]>();
  const seen = new Map<string, NormalizedSpecValue>();
  const conflicts = new Set<string>();

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const normKey = normalizeSpecKey(rawKey);
    if (rawKey.trim() !== normKey) renamedKeys.push({ from: rawKey, to: normKey });

    if (!Object.hasOwn(SPEC_RULES, normKey)) {
      unknownKeys.push(normKey);
      continue;
    }
    const rule = SPEC_RULES[normKey];
    if (!rule) continue;

    if (isNullLike(rawValue)) {
      droppedNullLikeKeys.push(normKey);
      discardedSpecs.push({ rawKey, key: normKey, value: rawValue, reason: "null_like" });
      continue;
    }

    if (rule === "string" && typeof rawValue === "string" && isInvalidStringValue(rawValue)) {
      discardedSpecs.push({ rawKey, key: normKey, value: rawValue, reason: "invalid_value" });
      continue;
    }

    let value: unknown = rawValue;
    if (normKey === "Nº de serie") {
      const s = String(rawValue).trim();
      if (!s || isNullLike(s)) {
        droppedNullLikeKeys.push(normKey);
        discardedSpecs.push({ rawKey, key: normKey, value: rawValue, reason: "null_like" });
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
      if (!s) {
        discardedSpecs.push({ rawKey, key: normKey, value: rawValue, reason: "invalid_value" });
        continue;
      }
      value = s;
    }

    const parsed = applyRule(rule, value, rawKey, normKey);
    if (parsed === null) {
      droppedNullLikeKeys.push(normKey);
      discardedSpecs.push({ rawKey, key: normKey, value: rawValue, reason: rejectionReason(value, normKey, rule) });
    }
    const keys = sources.get(normKey) ?? [];
    keys.push(rawKey);
    sources.set(normKey, keys);
    if (seen.has(normKey) && JSON.stringify(seen.get(normKey)) !== JSON.stringify(parsed)) {
      conflicts.add(normKey);
    } else if (!seen.has(normKey)) {
      seen.set(normKey, parsed);
    }
    if (conflicts.has(normKey)) delete normalized[normKey];
    else if (parsed !== null) normalized[normKey] = parsed;
  }

  for (const [rawKey, value] of Object.entries(input)) {
    const key = normalizeSpecKey(rawKey);
    if (conflicts.has(key)) discardedSpecs.push({ rawKey, key, value, reason: "alias_conflict" });
  }

  const unknownUnique = Array.from(new Set(unknownKeys)).sort((a, b) => a.localeCompare(b, "es"));
  const conflictingKeys = Array.from(conflicts).sort((a, b) => a.localeCompare(b, "es"))
    .map((key) => ({ key, sources: [...(sources.get(key) ?? [])].sort((a, b) => a.localeCompare(b, "es")) }));
  return { normalized, unknownKeys: unknownUnique, renamedKeys, droppedNullLikeKeys, conflictingKeys, discardedSpecs };
};

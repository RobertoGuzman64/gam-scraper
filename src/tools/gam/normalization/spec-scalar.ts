import { explicitNumericSpecUnit, type NormalizedSpecValue } from "../../../catalog/normalization/normalize-specs.js";

export const normalizeSpace = (s: string): string => s.replace(/\s+/g, " ").trim();

export const isSpecColumn = (h: string): boolean => h.startsWith("spec__");

export const toScalarString = (v: string | number | boolean): string => {
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const hasRawString = (v: Record<string, unknown>): v is Record<string, unknown> & { raw: string } =>
  typeof v.raw === "string";

const readNumKey = (obj: Record<string, unknown>, key: string): number | null => {
  const v = obj[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
};

const formatNumericPart = (value: number): string => {
  const literal = String(value);
  if (literal.includes("e")) return value.toLocaleString("es-ES", { useGrouping: false, maximumSignificantDigits: 21 });
  return /^-?\d{1,3}\.\d{3}$/u.test(literal) ? literal.replace(".", ",") : literal;
};

export const toSpecColumnString = (key: string, value: string | number | boolean): string => {
  if (typeof value !== "number") return toScalarString(value);
  const unit = explicitNumericSpecUnit(key);
  const numeric = formatNumericPart(value);
  return unit ? `${numeric} ${unit}` : numeric;
};

const formatDimParts = (parts: readonly (number | null)[]): string | null => {
  const cleaned = parts.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  return cleaned.length > 0 ? `${cleaned.map(formatNumericPart).join(" x ")} mm` : null;
};

export const normalizedValueToScalar = (v: NormalizedSpecValue): string | number | boolean | null => {
  if (v === null) return null;

  if (typeof v === "string") {
    const t = normalizeSpace(v);
    if (!t) return null;
    if (t === "[object Object]") return null;
    return t;
  }

  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;

  if (Array.isArray(v)) {
    const parts = v
      .map((n) => (typeof n === "number" && Number.isFinite(n) ? formatNumericPart(n) : ""))
      .filter((x) => x.length > 0);
    if (parts.length === 0) return null;
    return parts.join(" | ");
  }

  if (isPlainObject(v)) {
    if (hasRawString(v)) {
      const t = normalizeSpace(v.raw);
      if (!t || t === "[object Object]") return null;
      return t;
    }

    const largo = readNumKey(v, "largo");
    const ancho = readNumKey(v, "ancho");
    const grosor = readNumKey(v, "grosor");

    if (Object.hasOwn(v, "grosor")) {
      const dimension = formatDimParts([largo, ancho, grosor]);
      if (dimension) return dimension;
    } else if (Object.hasOwn(v, "ancho") && Object.hasOwn(v, "largo")) {
      const rectangle = formatDimParts([ancho, largo]);
      if (rectangle) return rectangle;
    }

    const s = JSON.stringify(v);
    const t = normalizeSpace(s);
    if (!t || t === "{}" || t === "[object Object]") return null;
    return t;
  }

  const s = String(v);
  const t = normalizeSpace(s);
  if (!t || t === "[object Object]") return null;
  return t;
};


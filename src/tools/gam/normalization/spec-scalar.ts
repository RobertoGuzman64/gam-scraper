import type { NormalizedSpecValue } from "../../../catalog/normalization/normalize-specs.js";

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

const formatDimParts = (parts: readonly (number | null)[]): string | null => {
  const cleaned = parts.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (cleaned.length === 0) return null;

  if (cleaned.length === 2) {
    const a = cleaned[0] ?? 0;
    const b = cleaned[1] ?? 0;
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    return `${hi}x${lo}`;
  }

  return cleaned.join("x");
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
      .map((n) => (typeof n === "number" && Number.isFinite(n) ? String(n) : ""))
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

    const dim3 = formatDimParts([largo, ancho, grosor]);
    if (dim3) return dim3;

    const dim2 = formatDimParts([largo, ancho]);
    if (dim2) return dim2;

    const dim1 = formatDimParts([largo]);
    if (dim1) return dim1;

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


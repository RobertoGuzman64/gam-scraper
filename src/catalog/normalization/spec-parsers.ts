
const lengthUnit = (raw: string): "mm" | "cm" | "m" | null => {
  const normalized = raw.toLowerCase();
  if (normalized === "mm" || normalized === "cm") return normalized;
  if (normalized === "m" || normalized === "metro" || normalized === "metros") return "m";
  return null;
};

export const parseMeasuredLength = (value: unknown, sourceKey: string, target: "mm" | "m"): number | null => {
  const keyUnit = sourceKey.match(/\((mm|cm|m)\)\s*$/i)?.[1];
  const fromKey = keyUnit ? lengthUnit(keyUnit) : null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    if (!fromKey || fromKey === target) return value;
    const inMillimeters = fromKey === "cm" ? value * 10 : fromKey === "m" ? value * 1000 : value;
    return target === "mm" ? inMillimeters : inMillimeters / 1000;
  }
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm|m|metros?)?$/i);
  if (!match?.[1]) return null;
  const unit = match[2] ? lengthUnit(match[2]) : null;
  if (unit && fromKey && unit !== fromKey) return null;
  const from = unit ?? fromKey ?? target;
  const literal = match[1];
  if (from === "m" && /^\d{1,3}\.\d{3}$/.test(literal)) return null;
  let numeric: number;
  if (/^\d{1,3}\.\d{3}$/.test(literal) && from !== "m") numeric = Number(literal.replace(".", ""));
  else numeric = Number(literal.replace(",", "."));
  if (!Number.isFinite(numeric) || numeric < 0 || (from === "m" && numeric >= 1000)) return null;
  if (from === target) return numeric;
  const inMillimeters = from === "cm" ? numeric * 10 : from === "m" ? numeric * 1000 : numeric;
  return target === "mm" ? inMillimeters : inMillimeters / 1000;
};
const normalizeNumericString = (input: string): string => {
  const s = input.trim();
  if (!s) return "";

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    return s.replace(/\./g, "").replace(/,/g, ".");
  }

  if (hasComma && !hasDot) {
    return s.replace(/,/g, ".");
  }

  if (hasDot && !hasComma) {
    const dots = (s.match(/\./g) ?? []).length;
    if (dots >= 2) return s.replace(/\./g, "");
    if (/^\d{1,3}\.\d{3}$/.test(s)) return s.replace(/\./g, "");
  }

  return s;
};

export const parseNumber = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  const raw = String(v);
  const cleaned = normalizeNumericString(raw).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
};

export const parseNumberArray = (v: unknown): readonly number[] | null => {
  if (v === null || v === undefined || v === "") return null;
  const txt = Array.isArray(v) ? v.join(" ") : String(v);
  const tokens = txt
    .replace(/[^\d.,\s/-]/g, " ")
    .split(/[\s/-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const nums = tokens
    .map((t) => parseNumber(normalizeNumericString(t)))
    .filter((n): n is number => n !== null && Number.isFinite(n));

  return nums.length === 0 ? null : nums;
};

export type Dimension = {
  readonly largo: number | null;
  readonly ancho: number | null;
  readonly grosor: number | null;
};

export const parseDimension = (v: unknown): Dimension | null => {
  if (v === null || v === undefined || v === "") return null;
  const txt = String(v).toLowerCase();
  const nums = txt.match(/\d+/g);
  if (!nums) return null;
  const parsed = nums.map((n) => Number(n));
  const largo = parsed[0] ?? null;
  const ancho = parsed[1] ?? null;
  const grosor = parsed[2] ?? null;
  return { largo, ancho, grosor };
};

export type DimensionRect = {
  readonly ancho: number | null;
  readonly largo: number | null;
};

export const parseDimensionRect = (v: unknown): DimensionRect | null => {
  if (v === null || v === undefined || v === "") return null;
  const nums = String(v)
    .toLowerCase()
    .replace(/[^\dx]/g, "")
    .split("x")
    .map((n) => parseNumber(n));
  if (nums.length < 2) return null;
  return { ancho: nums[0] ?? null, largo: nums[1] ?? null };
};

export type Battery = {
  readonly voltaje: number | null;
  readonly capacidadAh: readonly number[] | null;
  readonly tecnologia: "Li-ion" | "Lead-Acid" | "Gel" | null;
  readonly raw: string;
};

export const parseBattery = (v: unknown): Battery | null => {
  if (v === null || v === undefined || v === "") return null;
  const txt = String(v);
  const m = txt.match(/(\d+)\s*v/i);
  const volt = m?.[1] ? parseNumber(m[1]) : null;
  const ahMatches = txt.match(/(\d+)\s*ah/gi) ?? null;
  const ah = ahMatches ? ahMatches.map((x) => parseNumber(x)).filter((n): n is number => n !== null) : null;

  let tecnologia: Battery["tecnologia"] = null;
  if (/litio|li-ion|liion/i.test(txt)) tecnologia = "Li-ion";
  if (/plomo|lead/i.test(txt)) tecnologia = "Lead-Acid";
  if (/gel/i.test(txt)) tecnologia = "Gel";

  return {
    voltaje: volt ?? null,
    capacidadAh: ah && ah.length > 0 ? ah : null,
    tecnologia,
    raw: txt
  };
};

export const parseBoolean = (v: unknown): boolean | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim().toLowerCase();
  if (t === "si" || t === "sí" || t === "yes" || t === "true" || t === "1") return true;
  if (t === "no" || t === "false" || t === "0") return false;
  return null;
};

export const cleanEnum = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim();
};

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

export const parseNumber = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isNaN(n) ? null : n;
};

export const parseNumberArray = (v: unknown): readonly number[] | null => {
  if (v === null || v === undefined || v === "") return null;
  const txt = Array.isArray(v) ? v.join(" ") : String(v);
  const nums = txt
    .replace(/[^\d.\s/-]/g, " ")
    .split(/[\s/-]+/)
    .map((n) => parseFloat(n))
    .filter((n) => !Number.isNaN(n));
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
    .map((n) => parseFloat(n));
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
  if (t === "si" || t === "sí" || t === "yes" || t === "true") return true;
  if (t === "no" || t === "false") return false;
  return null;
};

export const cleanEnum = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim();
};

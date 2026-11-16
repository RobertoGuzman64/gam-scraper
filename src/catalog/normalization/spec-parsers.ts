
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
const unitAlternatives: Readonly<Record<string, readonly string[]>> = {
  kg: ["kg", "kilogramo", "kilogramos"],
  kw: ["kw"],
  cv: ["cv"],
  v: ["v", "voltio", "voltios"],
  ah: ["ah"],
  kwh: ["kwh"],
  "km/h": ["km/h"],
  km: ["km", "kms", "kilometro", "kilometros", "kilómetro", "kilómetros"],
  h: ["h", "hora", "horas"],
  nm: ["nm"],
  n: ["n"],
  "%": ["%"],
  rpm: ["rpm"],
  "m²/h": ["m²/h", "m2/h"],
  mm: ["mm"],
  m: ["m", "metro", "metros"],
  l: ["l", "litro", "litros"]
};

const parseNumericLiteral = (literal: string): number | null => {
  const grouped = /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(literal);
  const plain = /^[+-]?\d+(?:[.,]\d+)?$/.test(literal);
  if (!grouped && !plain) return null;
  const numeric = grouped && !/^[+-]?0\.\d{3}$/.test(literal)
    ? literal.replace(/\./g, "").replace(",", ".")
    : literal.replace(",", ".");
  const value = Number(numeric);
  return Number.isFinite(value) ? value : null;
};

export const parseNumber = (v: unknown, expectedUnit?: string): number | null => {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const matched = v.trim().match(/^([+-]?\d[\d.,]*)(?:\s*(.*))?$/u);
  if (!matched?.[1]) return null;
  const value = parseNumericLiteral(matched[1]);
  if (value === null) return null;
  const suffix = (matched[2] ?? "").trim().toLowerCase();
  if (!suffix) return value;
  if (expectedUnit) {
    const compatible = unitAlternatives[expectedUnit.toLowerCase()];
    return compatible?.includes(suffix) ? value : null;
  }
  return Object.values(unitAlternatives).some((units) => units.includes(suffix)) ? value : null;
};

export const parseYear = (value: unknown): number | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^(?:19|20)\d{2}$/.test(text)) return null;
  const year = Number(text);
  return year <= new Date().getUTCFullYear() ? year : null;
};

export const parseNumberArray = (
  v: unknown,
  expectedUnit?: string,
  allowPaired = false
): readonly number[] | null => {
  if (v === null || v === undefined || v === "") return null;
  if (Array.isArray(v)) {
    if (!v.length) return null;
    const parsed = v.map((item: unknown) => parseNumber(item, expectedUnit));
    return parsed.every((number): number is number => number !== null) ? parsed : null;
  }
  if (typeof v === "number") {
    const number = parseNumber(v, expectedUnit);
    return number === null ? null : [number];
  }
  if (typeof v !== "string") return null;
  const value = v.trim();
  if (allowPaired) {
    const paired = value.match(/^([+-]?\d[\d.,]*)\s*\/\s*([+-]?\d[\d.,]*)(?:\s+(.+))?$/u);
    if (paired?.[1] && paired[2]) {
      const first = parseNumber(paired[1], expectedUnit);
      const second = parseNumber(`${paired[2]}${paired[3] ? ` ${paired[3]}` : ""}`, expectedUnit);
      return first === null || second === null ? null : [first, second];
    }
  }
  if (value.includes("|")) {
    const tokens = value.split(/\s*\|\s*/u);
    if (tokens.length < 2 || tokens.some((token) => !token)) return null;
    const numbers = tokens.map((token) => parseNumber(token, expectedUnit));
    return numbers.every((number): number is number => number !== null) ? numbers : null;
  }
  const single = parseNumber(value, expectedUnit);
  return single === null ? null : [single];
};

export type Dimension = {
  readonly largo: number | null;
  readonly ancho: number | null;
  readonly grosor: number | null;
};

const dimensionPart = /^(\d+(?:[.,]\d+)?)\s*(mm|cm|m|metros?)?$/iu;

const parseDimensionAxes = (value: string, minAxes: number, maxAxes: number): readonly number[] | null => {
  const tokens = value.trim().split(/\s*[x×]\s*/iu);
  if (tokens.length < minAxes || tokens.length > maxAxes) return null;
  const parts = tokens.map((token) => token.match(dimensionPart));
  if (parts.some((part) => !part?.[1])) return null;
  const explicitUnits = parts.map((part) => part?.[2] ?? null);
  const lastUnit = explicitUnits[explicitUnits.length - 1];
  const onlyFinalUnit = explicitUnits.slice(0, -1).every((unit) => unit === null);
  const everyAxisHasUnit = explicitUnits.every((unit) => unit !== null);
  if (!onlyFinalUnit && !everyAxisHasUnit) return null;
  const values: number[] = [];
  for (const part of parts) {
    if (!part?.[1]) return null;
    const unit = part[2] ?? (onlyFinalUnit ? lastUnit : null);
    const numeric = parseMeasuredLength(`${part[1]}${unit ? ` ${unit}` : ""}`, "", "mm");
    if (numeric === null || numeric <= 0 || numeric > 20000) return null;
    values.push(Math.round(numeric * 1000) / 1000);
  }
  return values;
};

export const parseDimension = (v: unknown): Dimension | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const axes = parseDimensionAxes(String(v), 1, 3);
  if (!axes) return null;
  return { largo: axes[0] ?? null, ancho: axes[1] ?? null, grosor: axes[2] ?? null };
};

export type DimensionRect = {
  readonly ancho: number | null;
  readonly largo: number | null;
};

export const parseDimensionRect = (v: unknown): DimensionRect | null => {
  if (typeof v !== "string") return null;
  const text = v.trim().replace(/(mm|cm|m)\s+metros?$/iu, "$1");
  const axes = parseDimensionAxes(text, 2, 2);
  if (!axes || !/\b(?:mm|cm|m|metros?)$/iu.test(text)) return null;
  return { ancho: axes[0] ?? null, largo: axes[1] ?? null };
};

export type Battery = {
  readonly voltaje: number | null;
  readonly capacidadAh: readonly number[] | null;
  readonly tecnologia: "Li-ion" | "Lead-Acid" | "Gel" | null;
  readonly raw: string;
};

const batteryMeasurements = (text: string, unit: "V" | "Ah"): readonly number[] | null => {
  const pattern = unit === "V"
    ? /(?<![\p{L}\p{N}.,])(\d[\d.,]*)\s*(?:v|voltios?)\b/giu
    : /(?<![\p{L}\p{N}.,])(\d[\d.,]*)\s*ah\b/giu;
  const values: number[] = [];
  for (const match of text.matchAll(pattern)) {
    const prefix = text.slice(0, match.index);
    if (/\d[\d.,]*\s*(?:\/|[-–]|[x×])\s*$/iu.test(prefix)) return null;
    const value = parseNumber(match[0], unit);
    if (value === null || value < 0) return null;
    values.push(value);
  }
  return values.length > 0 ? values : null;
};

export const parseBattery = (v: unknown): Battery | null => {
  if (v === null || v === undefined || v === "") return null;
  const txt = String(v);
  const voltages = batteryMeasurements(txt, "V");
  const volt = voltages?.length === 1 ? voltages[0] : null;
  const ah = batteryMeasurements(txt, "Ah");

  let tecnologia: Battery["tecnologia"] = null;
  if (/litio|li-ion|liion/i.test(txt)) tecnologia = "Li-ion";
  if (/plomo|lead/i.test(txt)) tecnologia = "Lead-Acid";
  if (/gel/i.test(txt)) tecnologia = "Gel";

  return {
    voltaje: volt ?? null,
    capacidadAh: ah,
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

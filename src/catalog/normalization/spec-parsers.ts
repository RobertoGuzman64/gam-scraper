
const lengthUnit = (raw: string): "mm" | "cm" | "m" | null => {
  const normalized = raw.toLowerCase();
  if (normalized === "mm" || normalized === "cm") return normalized;
  if (normalized === "m" || normalized === "metro" || normalized === "metros") return "m";
  return null;
};

const lengthScale = { mm: 0, cm: 1, m: 3 } as const;

const convertLength = (value: number, source: keyof typeof lengthScale, target: "mm" | "m"): number | null => {
  if (source === target) return value;
  const [mantissa, exponent = "0"] = String(value).split("e");
  const result = Number(`${mantissa}e${Number(exponent) + lengthScale[source] - lengthScale[target]}`);
  return Number.isFinite(result) ? result : null;
};

export const parseMeasuredLength = (value: unknown, sourceKey: string, target: "mm" | "m"): number | null => {
  const keyUnit = sourceKey.match(/\((mm|cm|m)\)\s*$/i)?.[1];
  const fromKey = keyUnit ? lengthUnit(keyUnit) : null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    if (!fromKey || fromKey === target) return value;
    return convertLength(value, fromKey, target);
  }
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm|m|metros?)?(?:\s+(mm|cm|m|metros?))?$/i);
  if (!match?.[1]) return null;
  const unit = match[2] ? lengthUnit(match[2]) : null;
  if (match[3] && (!unit || lengthUnit(match[3]) !== unit)) return null;
  if (unit && fromKey && unit !== fromKey) return null;
  const from = unit ?? fromKey ?? target;
  const literal = match[1];
  const grouped = /^\d{1,3}\.\d{3}$/.test(literal) && !literal.startsWith("0.");
  if (from === "m" && grouped) return null;
  let numeric: number;
  if (grouped && from !== "m") numeric = Number(literal.replace(".", ""));
  else numeric = Number(literal.replace(",", "."));
  if (!Number.isFinite(numeric) || numeric < 0 || (from === "m" && numeric >= 1000)) return null;
  if (from === target) return numeric;
  return convertLength(numeric, from, target);
};
const unitAlternatives: Readonly<Record<string, readonly string[]>> = {
  kg: ["kg", "kilogramo", "kilogramos"],
  kw: ["kw"],
  w: ["w"],
  hz: ["hz"],
  a: ["a"],
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

export const canonicalNumericUnit = (raw: string): string | null => {
  const unit = raw.trim().toLowerCase();
  return Object.keys(unitAlternatives).find((key) => unitAlternatives[key]?.includes(unit)) ?? null;
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
  const text = v.trim();
  const groupedUnit = expectedUnit?.toLowerCase();
  const groupedUsage = groupedUnit === "h" || groupedUnit === "km"
    ? /^(\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:\s*(.*))?$/iu.exec(text) : null;
  if (groupedUsage?.[1] && groupedUnit) {
    const suffix = groupedUsage[2]?.trim().toLowerCase();
    if (suffix && !unitAlternatives[groupedUnit]?.includes(suffix)) return null;
    const usage = Number(groupedUsage[1].replace(/[ \u00a0\u202f]/gu, ""));
    return Number.isSafeInteger(usage) ? usage : null;
  }
  const matched = text.match(/^([+-]?\d[\d.,]*)(?:\s*(.*))?$/u);
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

export const parseMillimeterAlternatives = (value: unknown): readonly number[] | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:\s*\/\s*\d+)+)\s*(?:mm)?$/iu.exec(value.trim());
  if (!match?.[1]) return null;
  const values = match[1].split("/").map((part) => parseMeasuredLength(part.trim(), "", "mm"));
  return values.every((number): number is number => number !== null && number > 0 && Number.isSafeInteger(number)) ? values : null;
};

export const parseExplicitLengthAlternatives = (value: unknown, sourceKey = "", target?: "mm" | "m"): string | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:,\d+|\.\d{1,2})?(?:\s*\/\s*\d+(?:,\d+|\.\d{1,2})?)+)\s*(mm|cm|m)$/iu.exec(value.trim());
  if (!match?.[1] || !match[2]) return null;
  const unit = lengthUnit(match[2]);
  if (unit === null) return null;
  const parts = match[1].split("/").map((part) => part.trim());
  const values = parts.map((part) => parseMeasuredLength(`${part} ${unit}`, sourceKey, target ?? (unit === "m" ? "m" : "mm")));
  if (values.some((number) => number === null || !Number.isFinite(number) || number <= 0)) return null;
  const powers = { mm: 0, cm: 1, m: 3 } as const;
  const literals = parts.map((part) => {
    if (!target) return part.replace(".", ",");
    const [whole = "", fraction = ""] = part.split(/[.,]/u);
    const digits = whole + fraction;
    const point = whole.length + powers[unit] - powers[target];
    const integer = (point <= 0 ? "0" : digits.slice(0, point).padEnd(point, "0")).replace(/^0+(?=\d)/u, "");
    const decimal = (point < 0 ? "0".repeat(-point) + digits : digits.slice(point)).replace(/0+$/u, "");
    return decimal ? `${integer},${decimal}` : integer;
  });
  return `${literals.join(" / ")} ${target ?? unit}`;
};

export type Dimension = {
  readonly largo: number | null;
  readonly ancho: number | null;
  readonly grosor: number | null;
};

const dimensionPart = /^(\d+(?:[.,]\d+)?)\s*(mm|cm|m|metros?)?$/iu;

const parseDimensionAxes = (value: string, minAxes: number, maxAxes: number, preservePrecision = false): readonly number[] | null => {
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
    const rounded = Math.round(numeric * 1000) / 1000;
    if (rounded <= 0 || (preservePrecision && Math.abs(rounded - numeric) > Number.EPSILON * numeric * 2)) return null;
    values.push(rounded);
  }
  return values;
};

const isNormalizedDimensionAxis = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 20000 && Math.round(v * 1000) / 1000 === v;

const hasExactDimensionKeys = (v: unknown, keys: readonly string[]): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) &&
  Object.keys(v).length === keys.length && keys.every((key) => Object.hasOwn(v, key));

export const parseDimension = (v: unknown): Dimension | null => {
  if (hasExactDimensionKeys(v, ["largo", "ancho", "grosor"])) {
    const { largo, ancho, grosor } = v;
    if (!isNormalizedDimensionAxis(largo) || (ancho !== null && !isNormalizedDimensionAxis(ancho)) ||
      (grosor !== null && (!isNormalizedDimensionAxis(grosor) || ancho === null))) return null;
    return { largo, ancho, grosor };
  }
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
  if (hasExactDimensionKeys(v, ["ancho", "largo"])) {
    const { ancho, largo } = v;
    return isNormalizedDimensionAxis(ancho) && isNormalizedDimensionAxis(largo) ? { ancho, largo } : null;
  }
  if (typeof v !== "string") return null;
  const text = v.trim().replace(/(mm|cm|m)\s+metros?$/iu, "$1");
  const axes = parseDimensionAxes(text, 2, 2);
  if (!axes || !/(?:mm|cm|m|metros?)$/iu.test(text)) return null;
  return { ancho: axes[0] ?? null, largo: axes[1] ?? null };
};

export const parseThreeAxisBasketPresentation = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/(mm|cm|m)\s+metros?$/iu, "$1");
  if (!/(?:mm|cm|m)$/iu.test(text)) return null;
  const axes = parseDimensionAxes(text, 3, 3, true);
  return axes ? `${axes.map((axis) => String(axis).replace(".", ",")).join(" x ")} mm` : null;
};

export const parseBatteryConfiguration = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const options = value.trim().replace(/(?:\s*\(V\s*\/\s*Ah\))+$/iu, "").split(/\s*\|\s*/u);
  const formatted: string[] = [];
  for (const option of options) {
    const compact = /^(?:([1-9]\d*)\s*[x×]\s*)?(\d+(?:,\d+|\.\d{1,2})?)\s*\/\s*(\d+(?:,\d+|\.\d{1,2})?)\s*V\s*\/\s*Ah$/iu.exec(option);
    const expanded = compact?.[2] && compact[3]
      ? `${compact[1] ? `${compact[1]} x ` : ""}${compact[2]} V / ${compact[3]} Ah` : option;
    const match = /^(?:(Li-ion)\s+|([1-9]\d*)\s*[x×]\s*)?(\d+(?:,\d+|\.\d{1,2})?)\s*V\s*\/\s*(\d+(?:,\d+|\.\d{1,2})?)(?:\s*([-–])\s*(\d+(?:,\d+|\.\d{1,2})?))?\s*Ah$/iu.exec(expanded);
    if (!match?.[3] || !match[4] || (match[2] && !Number.isSafeInteger(Number(match[2])))) return null;
    const voltage = parseNumber(match[3], "V");
    const minimum = parseNumber(match[4], "Ah");
    const maximum = match[6] ? parseNumber(match[6], "Ah") : minimum;
    if (voltage === null || voltage <= 0 || minimum === null || minimum <= 0 || maximum === null || maximum < minimum) return null;
    const decimal = (literal: string): string => literal.replace(".", ",");
    const prefix = match[1] ? "Li-ion " : match[2] ? `${match[2]} x ` : "";
    formatted.push(`${prefix}${decimal(match[3])} V / ${decimal(match[4])}${match[6] ? `${match[5]}${decimal(match[6])}` : ""} Ah`);
  }
  return formatted.join(" | ");
};

export const parseExplicitVoltagePresentation = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:,\d+|\.\d{1,2})?)(?:\s*\/\s*(\d+(?:,\d+|\.\d{1,2})?))?\s*v$/iu.exec(value.trim());
  if (!match?.[1]) return null;
  const parts = [match[1], match[2]].filter((part): part is string => part !== undefined);
  if (parts.some((part) => (parseNumber(part, "V") ?? 0) <= 0)) return null;
  return `${parts.map((part) => part.replace(".", ",")).join(" / ")} V`;
};

export const parseExplicitPowerPresentation = (value: unknown, declaredUnit?: "kW" | "CV"): string | null => {
  if (typeof value !== "string") return null;
  const match = /^(?:([1-9]\d*)\s*[x×]\s*)?(\d+(?:,\d+|\.\d{1,2})?)(?:\s*\/\s*(\d+(?:,\d+|\.\d{1,2})?))?\s*(w|kw|kva|cv)?$/iu.exec(value.trim());
  if (!match?.[2] || (match[3] && (!declaredUnit || match[1]))) return null;
  const units: Readonly<Record<string, string>> = { w: "W", kw: "kW", kva: "kVA", cv: "CV" };
  const unit = match[4] ? units[match[4].toLowerCase()] : declaredUnit;
  if (!unit || (declaredUnit && unit !== declaredUnit) || (parseNumber(match[2]) ?? -1) < 0 ||
    (match[3] && (parseNumber(match[3]) ?? -1) < 0) || (match[1] && !Number.isSafeInteger(Number(match[1])))) return null;
  return `${match[1] ? `${match[1]} x ` : ""}${match[2].replace(".", ",")}${match[3] ? ` / ${match[3].replace(".", ",")}` : ""} ${unit}`;
};

export const parseExplicitAngularPresentation = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const match = /^(±\s*)?(\d+(?:,\d+|\.\d{1,2})?)\s*[°º](?:\s*\+\s*(\d+(?:,\d+|\.\d{1,2})?)\s*[°º]|\s+(a cada lado|\(continua\)))?$/iu.exec(value.trim());
  if (!match?.[2] || (match[1] && (match[3] || match[4]))) return null;
  const parts = [match[2], match[3]].filter((part): part is string => part !== undefined);
  if (parts.some((part) => (parseNumber(part) ?? -1) < 0)) return null;
  const angles = parts.map((part) => `${part.replace(".", ",")}°`);
  return `${match[1] ? "±" : ""}${angles.join(" + ")}${match[4] ? ` ${match[4].toLocaleLowerCase("es")}` : ""}`;
};

export const normalizeBatteryChemistryLabel = (value: string): string => {
  const text = value.trim().normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");
  if (/^(?:bateria de )?litio$/u.test(text)) return "Litio";
  if (/^(?:bateria de )?plomo$/u.test(text)) return "Plomo";
  if (/^(?:bateria de )?plomo[- ]acido$/u.test(text)) return "Plomo-ácido";
  if (/^(?:li-ion|ion[- ]litio)$/u.test(text)) return "Ion-litio";
  if (/^(?:baterias? )?agm$/u.test(text)) return "AGM";
  if (text === "gel") return "Gel";
  return value;
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

export const normalizeMastLabel = (value: string): string => {
  const text = value.trim().normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");
  if (text === "simple" || text === "simplex") return "Simple";
  if (text === "duplex") return "Dúplex";
  if (text === "triplex" || text === "triple") return "Tríplex";
  if (text === "cuadruplex") return "Cuádruplex";
  return value;
};

export const normalizeWheelTractionLabel = (value: string): string => {
  const match = /^([2468])\s*[x×]\s*([2468])$/iu.exec(value.trim());
  if (!match?.[1] || !match[2] || Number(match[2]) > Number(match[1])) return value;
  return `${match[1]}x${match[2]}`;
};

export const cleanEnum = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim();
};

export const normalizeEnergyLabel = (value: string): string => {
  const text = value.trim().normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");
  if (text === "diesel" || text === "gasoil") return "Diésel";
  if (text === "electrico") return "Eléctrico";
  if (text === "electrica") return "Eléctrica";
  if (text === "glp" || text === "lpg") return "GLP";
  if (text === "gasolina") return "Gasolina";
  return value;
};

export const parseExplicitPercentagePresentation = (value: unknown, maximum?: number): string | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:,\d+|\.\d{1,2})?)\s*%$/u.exec(value.trim());
  const number = match ? parseNumber(value, "%") : null;
  if (!match?.[1] || number === null || (maximum !== undefined && number > maximum)) return null;
  return `${match[1].replace(".", ",")} %`;
};

export const parseExplicitBatteryCapacityRange = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:,\d+|\.\d{1,2})?)\s*[-–]\s*(\d+(?:,\d+|\.\d{1,2})?)\s*Ah$/iu.exec(value.trim());
  if (!match?.[1] || !match[2]) return null;
  const minimum = parseNumber(match[1], "Ah");
  const maximum = parseNumber(match[2], "Ah");
  if (minimum === null || maximum === null || minimum <= 0 || maximum < minimum) return null;
  return `${match[1].replace(".", ",")}-${match[2].replace(".", ",")} Ah`;
};

export const normalizeBatteryReplacementLabel = (value: string): string => {
  const text = value.trim().normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");
  if (text === "si" || text === "no") return text === "si" ? "Sí" : "No";
  return text === "sin baterias" ? "Sin baterías" : value;
};

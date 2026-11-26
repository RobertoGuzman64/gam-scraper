import { SPEC_KEY_NORMALIZATION, SPEC_ANGULAR_FIELDS, SPEC_LENGTH_UNITS, SPEC_MASS_UNITS, SPEC_VOLUME_UNITS, SPEC_ROTATION_UNITS, SPEC_ELECTRICAL_UNITS, SPEC_RULES, type SpecRuleType } from "./spec-rules.js";
import {
  cleanEnum,
  normalizeBatteryChemistryLabel,
  normalizeEnergyLabel,
  normalizeBatteryReplacementLabel,
  parseExplicitPercentagePresentation,
  parseExplicitBatteryCapacityRange,
  normalizeMastLabel,
  normalizeWheelTractionLabel,
  parseBattery,
  parseBatteryConfiguration,
  parseExplicitPowerPresentation,
  parseExplicitAngularPresentation,
  parseExplicitVoltagePresentation,
  parseBoolean,
  parseDimension,
  parseDimensionRect,
  parseThreeAxisBasketPresentation,
  parseExplicitLengthAlternatives,
  parseMeasuredLength,
  parseMillimeterAlternatives,
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

const canonicalKeys = new Map(Object.keys(SPEC_RULES).map((key) => [cleanKeyBase(key), key]));

export const normalizeSpecKey = (key: string): string => {
  const base = cleanKeyBase(key);
  return Object.hasOwn(SPEC_KEY_NORMALIZATION, base) ? (SPEC_KEY_NORMALIZATION[base] ?? key.trim()) : canonicalKeys.get(base) ?? key.trim();
};

export const reconcileSourceBatteryConfiguration = <T>(
  specs: Readonly<Record<string, T>>, originalSpecs: Readonly<Record<string, unknown>>
): { readonly specs: Readonly<Record<string, T | string>>; readonly rename: { readonly from: string; readonly to: string } | null } => {
  const target = "Batería (V / Ah)";
  const capacity = "Capacidad de la batería (Ah)";
  const genericKeys = new Set(["capacidad de la bateria", "capacidad bateria", "capacidad de bateria"]);
  const candidates = Object.keys(specs).filter((key) => genericKeys.has(cleanKeyBase(key)));
  const source = candidates.length === 1 ? candidates[0] : undefined;
  if (!source) return { specs, rename: null };
  const competing = (input: Readonly<Record<string, unknown>>): boolean => Object.entries(input).some(([key, value]) => {
    if (key === source) return false;
    const canonical = normalizeSpecKey(key);
    return genericKeys.has(cleanKeyBase(key)) || [target, capacity].includes(canonical) ||
      (["Batería", "Baterías"].includes(canonical) && parseBatteryConfiguration(value) !== null);
  });
  if (competing(specs) || competing(originalSpecs)) return { specs, rename: null };
  const value = parseBatteryConfiguration(specs[source]);
  if (value === null || parseBatteryConfiguration(originalSpecs[source]) !== value) return { specs, rename: null };
  const { [source]: removed, ...remaining } = specs;
  return { specs: { ...remaining, [target]: value }, rename: { from: source, to: target } };
};

export const reconcileSourceSpecsForNormalization = (input: Readonly<Record<string, unknown>>): {
  readonly specs: Readonly<Record<string, unknown>>;
  readonly renames: readonly { readonly from: string; readonly to: string }[];
} => {
  const battery = reconcileSourceBatteryConfiguration(input, input);
  const renames = battery.rename ? [battery.rename] : [];
  const target = "Elevación libre disponible";
  const candidates = Object.keys(battery.specs).filter((key) => cleanKeyBase(key) === "elevacion libre");
  const source = candidates.length === 1 ? candidates[0] : undefined;
  if (!source || Object.keys(battery.specs).some((key) => key !== source &&
    [target, "Elevación libre (mm)"].includes(normalizeSpecKey(key)))) return { specs: battery.specs, renames };
  const raw = battery.specs[source];
  const availability = typeof raw === "boolean" ? raw : typeof raw === "string" && /^(?:s[ií]|no|yes|true|false)$/iu.test(raw.trim())
    ? parseBoolean(raw) : null;
  if (availability === null) return { specs: battery.specs, renames };
  const { [source]: removed, ...remaining } = battery.specs;
  return { specs: { ...remaining, [target]: availability }, renames: [...renames, { from: source, to: target }] };
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
  (Object.hasOwn(SPEC_MASS_UNITS, key) ? SPEC_MASS_UNITS[key] : undefined) ??
  (Object.hasOwn(SPEC_VOLUME_UNITS, key) ? SPEC_VOLUME_UNITS[key] : undefined) ??
  (Object.hasOwn(SPEC_ROTATION_UNITS, key) ? SPEC_ROTATION_UNITS[key] : undefined) ??
  (Object.hasOwn(SPEC_ELECTRICAL_UNITS, key) ? SPEC_ELECTRICAL_UNITS[key] : undefined);

export const explicitNumericSpecUnit = (key: string): "kg" | "m" | undefined => {
  if (["Capacidad de la cesta", "Capacidad de plataforma", "Capacidad nominal de carga", "Capacidad de plataforma sin restricciones",
    "Peso maquina", "Peso operativo", "Peso sin carga", "Peso de servicio", "Peso con batería",
    "Peso en orden de marcha del modelo", "Peso neto del portapaneles"].includes(key)) return "kg";
  if (["Altura máxima replegada", "Altura máxima de plataforma", "Altura de plataforma recogida", "Anchura con ejes recogidos"].includes(key)) return "m";
  return undefined;
};

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

const isNumericDimensionAxes = (value: unknown): value is readonly number[] =>
  Array.isArray(value) && Array.from(value).every((axis: unknown) => typeof axis === "number");

const applyRule = (type: SpecRuleType, value: unknown, rawKey: string, normalizedKey: string): NormalizedSpecValue => {
  if (isNullLike(value)) return null;
  switch (type) {
    case "number": {
      if (normalizedKey === "Año" || normalizedKey === "Año de fabricación de la batería") return parseYear(value);
      if (["Número de estabilizadores hidráulicos", "Polos", "Número de ruedas"].includes(normalizedKey)) {
        if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:[.,]0{1,2})?$/u.test(value.trim()))) return null;
        const count = parseNumber(value);
        return count !== null && Number.isSafeInteger(count) && count >= 0 ? count : null;
      }
      if (normalizedKey === "Factor de potencia nominal") {
        if (typeof value !== "number" && (typeof value !== "string" || !/^(?:0|1)(?:[.,]\d+)?$/u.test(value.trim()))) return null;
        const factor = typeof value === "number" ? value : Number(value.trim().replace(",", "."));
        return Number.isFinite(factor) && factor >= 0 && factor <= 1 ? factor : null;
      }
      const measure = specUnit(normalizedKey);
      const explicitUnit = explicitNumericSpecUnit(normalizedKey);
      if (explicitUnit === "kg" &&
        !(typeof value === "number" && rawKey === normalizedKey) &&
        !/\(kg\)\s*$/iu.test(rawKey) && (typeof value !== "string" || !/(?:kg|kilogramos?)\s*$/iu.test(value))) return null;
      if (explicitUnit === "m" &&
        !(typeof value === "number" && rawKey === normalizedKey) &&
        (typeof value !== "string" || !/(?:mm|cm|m|metros?)\s*$/iu.test(value))) return null;
      if (measure === "mm" || measure === "m") {
        const scalar = parseMeasuredLength(value, rawKey, measure);
        if (scalar !== null) return scalar;
        if (["Anchura (mm)", "Longitud (mm)", "Radio de giro (mm)"].includes(normalizedKey)) {
          return parseExplicitLengthAlternatives(value, rawKey, measure);
        }
        return null;
      }
      const unit = measure;
      const number = parseNumber(value, unit);
      return number !== null && number >= 0 ? number : null;
    }
    case "number_array": {
      const unit = normalizedKey.match(/\(([^)]+)\)$/)?.[1];
      if (normalizedKey === "Voltaje" || normalizedKey === "Voltios") {
        const presentation = parseExplicitVoltagePresentation(value);
        const serializedPair = rawKey === normalizedKey && typeof value === "string" &&
          /^\d+(?:[.,]\d+)? \| \d+(?:[.,]\d+)?$/u.test(value) &&
          !value.split(" | ").some((part) => /^\d{1,3}\.\d{3}$/u.test(part));
        if (typeof value === "string" && presentation === null && !serializedPair && parseNumber(value, "V") === null) return null;
        const numbers = parseNumberArray(presentation ?? value, "V", presentation !== null);
        return numbers && numbers.length <= 2 && numbers.every((number) => number > 0) ? numbers : null;
      }
      if (["Capacidad de la batería (Ah)", "Capacidad batería (Ah)"].includes(normalizedKey)) {
        const range = parseExplicitBatteryCapacityRange(value);
        if (range !== null) return range;
      }
      const alternatives = normalizedKey === "Ancho promedio (mm)" || normalizedKey === "AST (mm)"
        ? parseMillimeterAlternatives(value) : null;
      if (["Potencia (kW)", "Potencia de tracción (kW)", "Potencia de elevación (kW)", "Potencia (CV)"].includes(normalizedKey)) {
        const presentation = parseExplicitPowerPresentation(value, normalizedKey === "Potencia (CV)" ? "CV" : "kW");
        if (presentation && /[x/]/u.test(presentation)) return presentation;
      }
      const numbers = alternatives ?? parseNumberArray(value, unit, normalizedKey === "Velocidad de desplazamiento con/sin carga (km/h)");
      return numbers?.every((number) => number >= 0) ? numbers : null;
    }
    case "dimension": {
      if (typeof value === "object" && rawKey !== normalizedKey) return null;
      if (isNumericDimensionAxes(value) && value.length >= 1 && value.length <= 3) {
        return parseDimension({ largo: value[0], ancho: value[1] ?? null, grosor: value[2] ?? null });
      }
      return parseDimension(value);
    }
    case "dimension_rect": {
      if (typeof value === "object" && rawKey !== normalizedKey) return null;
      if (isNumericDimensionAxes(value) && value.length === 2) {
        return parseDimensionRect({ ancho: value[0], largo: value[1] });
      }
      return parseDimensionRect(value) ?? parseThreeAxisBasketPresentation(value);
    }
    case "battery":
      return parseBattery(value);
    case "bool":
      return parseBoolean(value);
    case "enum":
      if (normalizedKey === "Tipo de batería" && typeof value === "string") return normalizeBatteryChemistryLabel(value.trim());
      if (normalizedKey === "Tipo Mástil" && typeof value === "string") return normalizeMastLabel(value.trim());
      if (normalizedKey === "Tracción" && typeof value === "string") return normalizeWheelTractionLabel(value.trim());
      if (["Tipo motor", "Combustible"].includes(normalizedKey) && typeof value === "string") return normalizeEnergyLabel(value.trim());
      return cleanEnum(value);
    case "location":
      return typeof value === "string" ? value.trim() : null;
    case "string":
      if (normalizedKey === "Batería (V / Ah)") return parseBatteryConfiguration(value);
      if (normalizedKey === "Batería" || normalizedKey === "Baterías") return parseBatteryConfiguration(value) ?? (typeof value === "string" ? value.trim() : null);
      if (normalizedKey === "Potencia" || normalizedKey === "Potencia de emergencia ESP") return parseExplicitPowerPresentation(value);
      if (["Tipo de motor", "Motorización"].includes(normalizedKey) && typeof value === "string") return normalizeEnergyLabel(value.trim());
      if (normalizedKey === "Estado baterías" && typeof value === "string") return parseExplicitPercentagePresentation(value, 100) ?? value.trim();
      if (normalizedKey === "Baterías nuevas" && typeof value === "string") return normalizeBatteryReplacementLabel(value.trim());
      if (SPEC_ANGULAR_FIELDS.has(normalizedKey)) {
        const angle = parseExplicitAngularPresentation(value);
        if (angle !== null) return angle;
        if (!["Rotación de torreta", "Rotación de plataforma", "Rotación de cesta"].includes(normalizedKey)) return null;
      }
      return typeof value === "string" ? value.trim() : null;
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
    if (rule === "string" && normKey !== "Batería (V / Ah)" && !SPEC_ANGULAR_FIELDS.has(normKey) && Array.isArray(value)) {
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

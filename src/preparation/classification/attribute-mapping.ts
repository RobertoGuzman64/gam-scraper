import { SPEC_KEY_NORMALIZATION } from "../../catalog/normalization/spec-rules.js";
import type { ProductRecord, SpecScalar, SpecsMap } from "../../contracts/catalog.js";
import type { Attribute, AttributeResolution, Candidate } from "./attribute-types.js";
import { fold, scalar, numberToken } from "./attribute-utils.js";
import { classificationProvider } from "./classification-provider.js";
import { editorialHasImplausibleWeight } from "../editorial/core/editorial-facts.js";

const notPublished = (value: SpecScalar): boolean =>
  typeof value === "string" && ["n/d", "n/a", "no disponible", "no informado", "sin datos", "-", "—", "a consultar"].includes(fold(value));

const aliases: Readonly<Record<string, readonly string[]>> = {
  "Tipo de mástil": ["Tipo Mástil"],
  "Capacidad de carga": ["Capacidad de carga (kg)"],
  "Altura de elevación": ["Altura de elevación (mm)", "Altura de elevación (m)"],
  "Peso operativo": ["Peso (kg)"],
  "Altura de trabajo": ["Altura de trabajo (mm)", "Altura de trabajo (m)"],
  "Altura de plataforma": ["Altura plataforma", "Altura plataforma (mm)", "Altura plataforma (m)"],
  "Pendiente superable": ["Pendiente superable (%)"],
  "Ancho de trabajo": ["Anchura trabajo (mm)"],
  "Potencia": ["Potencia (kW)"],
  "Horas de uso": ["Horas (h)", "Horas laborales"],
  "Año de fabricación": ["Año"],
  "Tipo de motor": ["Tipo motor"]
};

const unitOf = (source: string): "mm" | "cm" | "m" | "km" | "kg" | "kw" | "h" | "%" | null => {
  const value = fold(source);
  if (value === "metro" || value === "metros" || value === "m") return "m";
  if (value === "kilogramo" || value === "kilogramos" || value === "kg") return "kg";
  if (value === "hora" || value === "horas" || value === "h") return "h";
  if (value === "mm" || value === "cm" || value === "km" || value === "kw" || value === "%") return value;
  return null;
};

const numberValue = (value: SpecScalar, sourceKey: string, attribute: Attribute): number | null => {
  if (typeof value === "boolean") return null;
  let parsed: number;
  let explicit: ReturnType<typeof unitOf> = null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    parsed = value;
  } else {
    const matched = value.trim().match(/^([\d.,\s\u00a0\u202f]+)\s*([a-záéíóú%]+)?$/i);
    if (!matched?.[1]) return null;
    const numeric = numberToken(matched[1]);
    if (numeric === null) return null;
    parsed = numeric;
    explicit = matched[2] ? unitOf(matched[2]) : null;
    if (matched[2] && !explicit) return null;
  }
  const keyUnitMatch = sourceKey.match(/\((mm|cm|km|m|kg|kw|h|%)\)/i)?.[1];
  const keyUnit = keyUnitMatch ? unitOf(keyUnitMatch) : null;
  if (explicit && keyUnit && explicit !== keyUnit) return null;
  const sourceUnit = explicit ?? keyUnit;
  const targetUnit = attribute.name === "Potencia" && attribute.unit_option === "kVA (grupos) / kW" && sourceUnit === "kw"
    ? "kw" : unitOf(attribute.unit_option);
  if (sourceUnit && targetUnit && sourceUnit !== targetUnit) {
    const ratios: Readonly<Record<string, number>> = { mm: 0.001, cm: 0.01, m: 1 };
    if (!(sourceUnit in ratios) || !(targetUnit in ratios)) return null;
    return parsed * (ratios[sourceUnit] ?? 0) / (ratios[targetUnit] ?? 1);
  }
  if (sourceUnit && !targetUnit && !(attribute.name === "Horas de uso" && sourceUnit === "h")) return null;
  return parsed;
};

const convert = (value: SpecScalar, key: string, attribute: Attribute): string | number | boolean | null => {
  if (attribute.type === "NUMBER" || attribute.type === "DECIMAL") return numberValue(value, key, attribute);
  if (attribute.type === "DATE" || attribute.type === "MULTISELECT") return null;
  if (attribute.type === "BOOLEAN") {
    if (typeof value === "boolean") return value;
    if (typeof value !== "string") return null;
    if (["si", "true", "yes"].includes(fold(value))) return true;
    if (["no", "false"].includes(fold(value))) return false;
    return null;
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  const text = String(value).trim();
  return text || null;
};

const reviewedGeometryAttributes = new Set(["Altura de plataforma", "Alcance horizontal", "Extensión de plataforma"]);

const recoveredMotorKeys = ["Motorización", "Tipo motor", "Tipo de motor", "Motor", "Propulsión", "Combustible",
  "Motorización / Energía", "Tipo de combustible", "Tipo de propulsión", "Accionamiento"];

const recoveredElectricEnergy = (record: ProductRecord, attribute: Attribute, specs: SpecsMap): string | null => {
  if (attribute.name !== "Motorización / Energía" || attribute.type !== "SELECT" || fold(attribute.unit_option) !== "electrico" ||
    !["gam", "mercaeleva"].includes(record.providerId)) return null;
  const keys = new Set(recoveredMotorKeys.map(fold));
  const motorKey = (key: string): boolean => keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key));
  if (Object.keys(record.specs ?? {}).some(motorKey) ||
    /\b(?:diesel|gasolina|glp|hibrid[oa]|manual)\b/u.test(fold(`${record.title ?? ""} ${record.shortDescription ?? ""}`))) return null;
  const values = Object.entries(specs).filter(([key]) => motorKey(key)).map(([, value]) => value);
  return values.length > 0 && values.every((value) => typeof value === "string" && fold(value) === "electrico") ? "Eléctrico" : null;
};

const recoveredMeasuredFields: Readonly<Record<string, { readonly keys: readonly string[]; readonly unit: "mm" | "%" | "m";
  readonly minimum: number; readonly maximum: number }>> = {
  "Centro de carga": { keys: ["Centro de carga", "Centro de carga (mm)"], unit: "mm", minimum: 100, maximum: 2000 },
  "Radio de giro": { keys: ["Radio de giro", "Radio de giro (mm)"], unit: "mm", minimum: 500, maximum: 10000 },
  "Altura de elevación": { keys: ["Altura de elevación", "Altura de elevación (mm)"], unit: "mm", minimum: 100, maximum: 16000 },
  "Pendiente superable": { keys: ["Pendiente superable", "Pendiente superable (%)"], unit: "%", minimum: 0, maximum: 100 },
  "Altura de plataforma": { keys: ["Altura de plataforma", "Altura plataforma (m)"], unit: "m", minimum: 0.5, maximum: 60 }
};

const recoveredMeasuredValue = (record: ProductRecord, attribute: Attribute, specs: SpecsMap): number | null => {
  const field = recoveredMeasuredFields[attribute.name];
  if (!field || attribute.type !== "NUMBER" || attribute.unit_option !== field.unit || record.providerId !== "gam") return null;
  const keys = new Set(field.keys.map(fold));
  if (Object.keys(record.specs ?? {}).some((key) => keys.has(fold(key)) ||
    keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key))) ||
    (attribute.name === "Altura de elevación" && ["Altura máxima de elevación", "Altura de elevación máxima (mm)"].some((key) => record.specs?.[key] !== undefined))) return null;
  const explicit = new RegExp(`^\\d+(?:[.,]\\d{1,2})?\\s*${field.unit}$`, "iu");
  const values = Object.entries(specs).filter(([key]) => keys.has(fold(key))).map(([key, value]) =>
    typeof value === "string" && explicit.test(value) ? numberValue(value, key, attribute) : null);
  const first = values[0];
  return first !== undefined && first !== null && first >= field.minimum && first <= field.maximum &&
    values.every((value) => value === first) ? first : null;
};

const recoveredOperationalValue = (record: ProductRecord, attribute: Attribute, specs: SpecsMap): string | number | null => {
  if (record.providerId !== "gam") return null;
  const directKeys = Object.keys(record.specs ?? {}).map(fold);
  const hasDirect = (pattern: RegExp): boolean => directKeys.some((key) => pattern.test(key));
  if (attribute.name === "Posición del operario" && attribute.type === "SELECT" &&
    attribute.unit_option.split(/\s+\/\s+/).includes("Acompañante") &&
    ["apiladores-nuevos", "manutencion", "marcas-nuevas"].includes(record.categoryKey) &&
    !hasDirect(/conductor|conduccion|posicion.*(?:operario|operador)|plataforma.*(?:operario|operador)|puesto.*(?:operario|operador)/u)) {
    return specs["Posición de conducción"] === "Operador a pie" ? "Acompañante" : null;
  }
  if (attribute.name === "Tipo de tracción" && attribute.type === "SELECT" &&
    attribute.unit_option.split(/\s+\/\s+/).includes("Ruedas") && record.categoryKey === "elevacion-nueva" &&
    !hasDirect(/traccion|rodadura|neumaticos|orugas/u) && specs["Tracción 4x4"] === "true" &&
    /\btraccion (?:4\s*[x×]\s*4|en las cuatro ruedas)\b/u.test(fold(record.longDescription ?? "")) &&
    !/\b(?:orugas?|cadenas?|camion(?:es)?|opcional|alternativa)\b/u.test(fold(`${record.title ?? ""} ${record.longDescription ?? ""}`))) {
    return "Ruedas";
  }
  if (attribute.type !== "NUMBER") return null;
  if (attribute.name === "Rendimiento teórico" && attribute.unit_option === "m²/h" &&
    ["limpieza-fregadoras", "limpieza-barredoras"].includes(record.categoryKey) &&
    !hasDirect(/cobertura|productividad|rendimiento/u)) {
    const value = specs["Rendimiento de limpieza (m²/h)"];
    return typeof value === "string" && /^\d{3,5}$/u.test(value) && Number(value) >= 200 && Number(value) <= 30000
      ? Number(value) : null;
  }
  const measure = (keys: readonly string[], unit: RegExp, minimum: number, maximum: number): number | null => {
    const values = keys.filter((key) => specs[key] !== undefined).map((key) => {
      const raw = specs[key];
      const match = typeof raw === "string" ? unit.exec(raw.trim()) : null;
      return match?.[1] ? numberToken(match[1]) : null;
    });
    const first = values[0];
    return first !== undefined && first !== null && first >= minimum && first <= maximum &&
      values.every((value) => value === first) ? first : null;
  };
  if (attribute.name === "Potencia del motor" && attribute.unit_option === "kW" &&
    ["carretillas-nuevas", "otros-nuevos"].includes(record.categoryKey) &&
    !hasDirect(/potencia|motor de (?:traccion|elevacion)/u)) {
    return measure(["Potencia (kW)", "Potencia nominal del motor", "Potencia del motor"], /^(\d+(?:[.,]\d{1,2})?)\s*kW$/iu, 5, 300);
  }
  if (attribute.name === "Velocidad máxima" && attribute.unit_option === "km/h" && record.categoryKey === "maquinaria" &&
    !hasDirect(/velocidad/u) && /\b(?:ciclomotor|scooter|motocicleta|cuatriciclo)\s+electric[oa]\b/u.test(fold(record.longDescription ?? ""))) {
    return measure(["Velocidad de desplazamiento (km/h)", "Velocidad máxima"], /^(\d+(?:[.,]\d{1,2})?)\s*km\/h$/iu, 30, 160);
  }
  if (attribute.name === "Capacidad de arrastre" && attribute.unit_option === "kg" && record.categoryKey === "manutencion" &&
    !hasDirect(/capacidad.*arrastre|capacidad.*remolque/u)) {
    return measure(["Capacidad de arrastre (kg)", "Capacidad de arrastre"], /^(\d[\d., ]*)\s*kg$/iu, 100, 100000);
  }
  return null;
};

const recoveredUnitValue = (record: ProductRecord, attribute: Attribute, specs: SpecsMap): string | number | null => {
  const operational = recoveredOperationalValue(record, attribute, specs);
  if (operational !== null) return operational;
  const measured = recoveredMeasuredValue(record, attribute, specs);
  if (measured !== null) return measured;
  const motor = recoveredElectricEnergy(record, attribute, specs);
  if (motor !== null) return motor;
  const value = specs[attribute.name];
  if (typeof value !== "string") return null;
  if (attribute.name === "Neumáticos" && attribute.type === "SELECT") {
    const options = attribute.unit_option.split(/\s+\/\s+/);
    const option = options.find((item) => fold(item) === fold(value));
    if (option) return option;
    if (record.providerId !== "gam" || Object.keys(record.specs ?? {}).some((key) => /neumaticos|ruedas|bandaje/u.test(fold(key)))) return null;
    const normalized = fold(value);
    if (["solidos", "bandaje macizo"].includes(normalized) && options.includes("Macizos")) return "Macizos";
    if (/^\d[\d., x×-]*pr \(ruedas neumaticas\)$/u.test(normalized) && options.includes("Neumáticos")) return "Neumáticos";
    return null;
  }
  if (attribute.type !== "NUMBER") return null;
  if (attribute.unit_option === "l" && ["Depósito de solución", "Depósito de recuperación", "Capacidad de la tolva"].includes(attribute.name) &&
    /^\d+(?:[.,]\d{1,2})?$/u.test(value)) {
    const measured = numberToken(value);
    return measured !== null && measured > 0 ? measured : null;
  }
  if (attribute.name === "Rotación de torreta" && attribute.unit_option === "grados" && /^\d+(?:[.,]\d+)?[°º]$/u.test(value)) {
    const angle = numberToken(value.slice(0, -1));
    return angle !== null && angle > 0 && angle <= 360 ? angle : null;
  }
  if (reviewedGeometryAttributes.has(attribute.name) && attribute.unit_option === "m" && /^\d+(?:[.,]\d+)?\s*m$/iu.test(value)) {
    const measured = numberValue(value, attribute.name, attribute);
    return measured !== null && measured > 0 ? measured : null;
  }
  return null;
};

export const resolveAttribute = (record: ProductRecord, attribute: Attribute, reviewedModelSpecs: SpecsMap = {},
  recoveredUnitSpecs: SpecsMap = {}): AttributeResolution => {
  const rules = classificationProvider(record)?.attribute;
  if (rules?.suppress(record, attribute)) return { status: "not_observed", value: null };
  const keys = new Set([attribute.name, ...(aliases[attribute.name] ?? [])].map(fold));
  const candidates: Candidate[] = [];
  const outcome = rules?.addAliases(record, attribute, keys, candidates) ?? "accepted";
  if (outcome !== "accepted") return { status: outcome, value: null };
  let ambiguousSource = false;
  for (const [rawKey, spec] of Object.entries(record.specs ?? {})) {
    if (rules?.excludeSpec(record, attribute, rawKey)) continue;
    const canonical = SPEC_KEY_NORMALIZATION[fold(rawKey)] ?? rawKey;
    if (!keys.has(fold(rawKey)) && !keys.has(fold(canonical))) continue;
    const value = scalar(spec);
    if (value !== null && !notPublished(value) && !rules?.unmeasured(record, attribute, value)) {
      candidates.push({ key: rawKey, value });
    }
    else if (Array.isArray(spec) && spec.length > 1) ambiguousSource = true;
  }
  const extra: Readonly<Record<string, string | null>> = {
    "Marca": record.brand,
    "Modelo": record.model,
    "Año de fabricación": rules ? rules.sourceYear(record) : record.year?.trim() ?? null,
    "Horas de uso": record.horometer,
    "Ubicación / Delegación": record.location
  };
  const direct = extra[attribute.name];
  if (direct?.trim() && !rules?.unmeasured(record, attribute, direct)) {
    candidates.push({ key: attribute.name, value: direct });
  }
  if (candidates.length === 0) {
    const hasDirectSpec = Object.keys(record.specs ?? {}).some((key) => keys.has(fold(key)) ||
      keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key)));
    if (!ambiguousSource && !hasDirectSpec) {
      const recovered = recoveredUnitValue(record, attribute, recoveredUnitSpecs);
      if (recovered !== null) return { status: "resolved", value: recovered };
    }
    const reviewed = reviewedModelSpecs[attribute.name];
    if (!ambiguousSource && attribute.type === "NUMBER" && attribute.unit_option === "m" &&
      reviewedGeometryAttributes.has(attribute.name) && typeof reviewed === "string" &&
      /^\d+(?:[.,]\d+)?\s*m$/iu.test(reviewed.trim()) &&
      !hasDirectSpec) {
      const value = numberValue(reviewed, attribute.name, attribute);
      if (value !== null && value > 0) return { status: "resolved", value };
    }
    return { status: ambiguousSource ? "rejected" : "not_observed", value: null };
  }
  if ((attribute.name === "Peso" || attribute.name === "Peso operativo") &&
    (attribute.type === "NUMBER" || attribute.type === "DECIMAL") && unitOf(attribute.unit_option) === "kg" &&
    candidates.some((candidate) => candidate.key === "Peso") && editorialHasImplausibleWeight(record)) {
    return { status: "rejected", value: null };
  }
  const converted = candidates.map((candidate) => {
    const fallback = convert(candidate.value, candidate.key, attribute);
    return rules ? rules.convert(record, attribute, candidate, fallback) : fallback;
  });
  if (converted.some((value) => value === null)) return { status: "invalid", value: null };
  const first = converted[0];
  if (first === undefined || first === null) return { status: "invalid", value: null };
  return converted.every((value) => value === first)
    ? { status: "resolved", value: first }
    : { status: "contradiction", value: null };
};

export const resolveAttributeValue = (record: ProductRecord, attribute: Attribute): string | number | boolean | null =>
  resolveAttribute(record, attribute).value;

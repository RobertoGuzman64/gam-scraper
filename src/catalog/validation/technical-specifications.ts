import type { SpecsMap, SpecValue } from "../../contracts/catalog.js";

export type TechnicalSpecificationIssueCode =
  "unidad-tecnica-malformada" | "magnitud-en-campo-incompatible" |
  "residuo-hoja-calculo" | "longitud-fisicamente-implausible";

export type TechnicalSpecificationIssue = {
  readonly key: string;
  readonly code: TechnicalSpecificationIssueCode;
};

const geometryKey = /\b(?:altura|altitud|ancho|anchura|longitud|largo|radio de giro|alcance|profundidad|distancia|dimensiones|centro de carga)\b/iu;
const batteryKey = /\bcapacidad\b.*\bbater[ií]a\b|\bbater[ií]a\b.*\bcapacidad\b/iu;
const batteryMagnitude = /\b\d+(?:[.,]\d+)?\s*(?:V|Ah|kWh)\b|\(\s*V\s*\/\s*Ah\s*\)/iu;
const lengthMagnitude = /\b\d+(?:[.,]\d+)?\s*(?:mm|cm|metros?)\b/iu;
const malformedValue = /(?:mm|m)\s+metros?\b|\b\d+(?:[.,]\d+)?\s*mmmm\b|\(V\/Ah\)\s*\(V\/Ah\)|\b\d+\s*h\s*\(V\/Ah\)/iu;
const spreadsheetError = /#(?:VALUE!|REF!|DIV\/0!|N\/A|NUM!|NAME\?|NULL!)/iu;

const inspectValue = (key: string, value: string): TechnicalSpecificationIssueCode | null => {
  if (spreadsheetError.test(value)) return "residuo-hoja-calculo";
  if (geometryKey.test(key) && batteryMagnitude.test(value)) return "magnitud-en-campo-incompatible";
  if (batteryKey.test(key) && lengthMagnitude.test(value)) return "magnitud-en-campo-incompatible";
  if (geometryKey.test(key) && /^\s*[1-9]\d{3,}\s+metros?\s*$/iu.test(value)) {
    return "longitud-fisicamente-implausible";
  }
  return malformedValue.test(value) ? "unidad-tecnica-malformada" : null;
};

const inspectSpecification = (key: string, value: SpecValue): TechnicalSpecificationIssueCode | null => {
  if (typeof value === "string") return inspectValue(key, value);
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "string") continue;
      const code = inspectValue(key, item);
      if (code !== null) return code;
    }
  }
  return null;
};

const isSpecScalar = (value: unknown): boolean =>
  typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));

export const isPresentableSpecifications = (value: unknown): value is SpecsMap =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.entries(value).every(([key, item]) =>
    (isSpecScalar(item) || (Array.isArray(item) && item.every(isSpecScalar))) &&
    (typeof item === "string" || Array.isArray(item) ? inspectSpecification(key, item) === null : true));

export const inspectTechnicalSpecifications = (spec: SpecsMap): readonly TechnicalSpecificationIssue[] =>
  Object.entries(spec).flatMap(([key, value]) => {
    const code = inspectSpecification(key, value);
    return code === null ? [] : [{ key, code }];
  });

export type TechnicalCoherenceIssueCode =
  "unidad-tecnica-duplicada" | "valor-centinela-no-utilizable" |
  "centro-carga-supera-longitud" | "capacidad-bateria-coincide-peso" |
  "capacidad-bateria-sin-unidad-con-alternativa";

export type TechnicalCoherenceIssue = {
  readonly key: string;
  readonly code: TechnicalCoherenceIssueCode;
  readonly relatedKeys: readonly string[];
};

const repeatedMeasurementUnit = /\b\d+(?:[.,]\d+)?\s*(mm|cm|kg)\s+\1\b/iu;
const nonUsableMeasurement = /^\s*[−–-]\s*1(?:[.,]0+)?\s*(?:mm|h)\s*$/iu;
const nonNegativeField = /\b(?:horas?|hor[oó]metro|distancia del centro de gravedad)\b/iu;
const electricalBatteryValue = /\b\d+\s*V\b.{0,60}\b\d+(?:-\d+)?\s*Ah\b/iu;

const textSpecification = (spec: SpecsMap, key: string): string | null => {
  const value = spec[key];
  return typeof value === "string" ? value.trim() : null;
};

const millimetres = (value: string | null): number | null => {
  if (value === null) return null;
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)\s*mm$/iu.exec(value);
  return match?.[1] ? Number(match[1].replace(/\./gu, "")) : null;
};

const kilograms = (value: string | null): number | null => {
  if (value === null) return null;
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)\s*kg$/iu.exec(value);
  return match?.[1] ? Number(match[1].replace(/\./gu, "")) : null;
};

export const inspectTechnicalCoherence = (spec: SpecsMap): readonly TechnicalCoherenceIssue[] => {
  const issues: TechnicalCoherenceIssue[] = [];
  const add = (key: string, code: TechnicalCoherenceIssueCode, relatedKeys: readonly string[] = []): void => {
    issues.push({ key, code, relatedKeys });
  };
  for (const [key, value] of Object.entries(spec)) {
    const texts = typeof value === "string" ? [value] : Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string") : [];
    if (texts.some((item) => repeatedMeasurementUnit.test(item))) add(key, "unidad-tecnica-duplicada");
    if (nonNegativeField.test(key) && texts.some((item) => nonUsableMeasurement.test(item))) {
      add(key, "valor-centinela-no-utilizable");
    }
  }
  const centre = millimetres(textSpecification(spec, "Centro de carga"));
  const length = millimetres(textSpecification(spec, "Longitud"));
  if (centre !== null && length !== null && length > 0 && centre > length) {
    add("Centro de carga", "centro-carga-supera-longitud", ["Longitud"]);
  }
  const battery = textSpecification(spec, "Capacidad de la batería");
  if (battery === null || !/^[1-9]\d{2,4}$/u.test(battery)) return issues;
  const weight = textSpecification(spec, "Peso");
  if (kilograms(weight) === Number(battery)) {
    add("Capacidad de la batería", "capacidad-bateria-coincide-peso", ["Peso"]);
    return issues;
  }
  const alternative = Object.entries(spec).find(([key, value]) =>
    geometryKey.test(key) && typeof value === "string" && electricalBatteryValue.test(value));
  if (alternative) {
    add("Capacidad de la batería", "capacidad-bateria-sin-unidad-con-alternativa", [alternative[0]]);
  }
  return issues;
};

const capacityValue = (value: string): number | null => {
  const found = /\b(\d{1,3}(?:\.\d{3})+|\d{3,5})\s*kg\b/iu.exec(value);
  return found?.[1] ? Number(found[1].replace(/\./gu, "")) : null;
};

export const hasTechnicalLoadCapacityDisagreement = (title: string | null, spec: SpecsMap): boolean => {
  if (!title || !/\b(?:carretilla|transpaleta)\b/iu.test(title)) return false;
  const titleCapacity = capacityValue(title);
  if (titleCapacity === null) return false;
  const load = spec["Capacidad de carga (kg)"] ?? spec["Capacidad máxima de elevación"];
  if (typeof load !== "string") return false;
  const technicalCapacity = capacityValue(load);
  return technicalCapacity !== null && titleCapacity !== technicalCapacity;
};

import type { SpecsMap, SpecValue } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../legacy-export/contracts.js";

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

const capacityValue = (value: string): number | null => {
  const found = /\b(\d{1,3}(?:\.\d{3})+|\d{3,5})\s*kg\b/iu.exec(value);
  return found?.[1] ? Number(found[1].replace(/\./gu, "")) : null;
};

export const hasLoadCapacityDisagreement = (
  product: Pick<ImportCandidate, "title" | "spec">
): boolean => {
  if (!product.title || !/\b(?:carretilla|transpaleta)\b/iu.test(product.title)) return false;
  const titleCapacity = capacityValue(product.title);
  if (titleCapacity === null) return false;
  const load = product.spec["Capacidad de carga (kg)"] ?? product.spec["Capacidad máxima de elevación"];
  if (typeof load !== "string") return false;
  const technicalCapacity = capacityValue(load);
  return technicalCapacity !== null && titleCapacity !== technicalCapacity;
};

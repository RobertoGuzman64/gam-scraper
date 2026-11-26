import { parseExplicitPowerPresentation, parseExplicitVoltagePresentation } from "../../catalog/normalization/spec-parsers.js";
import type { ProductRecord, SpecsMap, SpecValue } from "../../contracts/catalog.js";
import { editorialQuantity, formatEditorialQuantity } from "../editorial/measurements/editorial-measurements.js";

import { resolveManainEditorialDomainSource } from "./domain-source.js";
import { manainSourceFamily, manainSourceDescriptionContradictsFamily } from "./source.js";
import { reconcileOriginalMassCapacityPresentation } from "../technical/technical-presentation.js";
import type { TechnicalRecoveryObservation } from "../provenance/technical-recovery-observation.js";

export const reconcileManainMassCapacityPresentation = (original: ProductRecord, specs: SpecsMap,
  observe?: TechnicalRecoveryObservation): SpecsMap => {
  const family = manainSourceFamily(original);
  if (!family || manainSourceDescriptionContradictsFamily(original, family) ||
    !resolveManainEditorialDomainSource(original)) return specs;
  const field = family.startsWith("elevacion-") ? "Capacidad de la cesta" :
    original.specs?.["Altura trabajo"] !== undefined ? null :
      family === "manipulacion-manipulador" ? "Capacidad máxima de elevación" :
        ["manipulacion-carretilla", "manipulacion-carretilla-4x4", "manipulacion-transpaletas", "manipulacion-retractil", "manipulacion-apilador"].includes(family) ? "Capacidad de carga" : null;
  if (field === null) return specs;
  return reconcileOriginalMassCapacityPresentation(original, specs, "Capacidad carga", field,
    "src/preparation/manain/normalization.ts", observe);
};

const weightAliases = ["Peso maquina", "Peso operativo", "Peso sin carga", "Peso carretilla en vacio"] as const;

const normalizeMetricPresentation = (key: string, value: SpecValue): SpecValue => {
  if (typeof value !== "string" || ["Marca", "Modelo", "Referencia"].includes(key) ||
    !/^\d{1,3}\.\d{1,2}\s+m$/u.test(value.trim())) return value;
  const metres = editorialQuantity(value, "m");
  return metres === null ? value : `${formatEditorialQuantity(metres)} m`;
};

const normalizeGeneratorElectricalPresentation = (record: ProductRecord, key: string, value: SpecValue): SpecValue => {
  if (typeof value !== "string" || record.specs?.[key] !== value ||
    manainSourceFamily(record) !== "energia-grupo-electrogeno" || manainSourceDescriptionContradictsFamily(record, "energia-grupo-electrogeno")) return value;
  if (key === "Potencia" && /kva\s+kva$/iu.test(value.trim())) {
    return parseExplicitPowerPresentation(value.trim().replace(/\s+kva$/iu, "")) ?? value;
  }
  if (key === "Voltios" && /v\s+v$/iu.test(value.trim())) {
    return parseExplicitVoltagePresentation(value.trim().replace(/\s+v$/iu, "")) ?? value;
  }
  return value;
};

export const normalizeManainTechnicalSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (record.providerId !== "manain") return specs;
  const weight = editorialQuantity(specs.Peso, "kg");
  const redundant = weight === null ? [] :
    weightAliases.filter((key) => editorialQuantity(specs[key], "kg") === weight);
  let normalized: Record<string, SpecValue> | null = null;
  for (const key of redundant) {
    normalized ??= { ...specs };
    delete normalized[key];
  }
  for (const [key, value] of Object.entries(specs)) {
    const repeatedModel = key === "Modelo" && typeof value === "string" && value === record.model ?
      /^([^,]{2,80}),\s*([^,]{2,80})$/u.exec(value.trim()) : null;
    const formatted = repeatedModel?.[1]?.trim() && repeatedModel[1].trim() === repeatedModel[2]?.trim() ?
      repeatedModel[1].trim() : normalizeMetricPresentation(key, normalizeGeneratorElectricalPresentation(record, key, value));
    if (formatted === value) continue;
    normalized ??= { ...specs };
    normalized[key] = formatted;
  }
  return normalized ?? specs;
};

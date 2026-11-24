import type { ProductRecord, SpecsMap, SpecValue } from "../../contracts/catalog.js";
import { editorialQuantity, formatEditorialQuantity } from "../editorial/measurements/editorial-measurements.js";

const weightAliases = ["Peso maquina", "Peso operativo", "Peso sin carga", "Peso carretilla en vacio"] as const;

const normalizeMetricPresentation = (key: string, value: SpecValue): SpecValue => {
  if (typeof value !== "string" || ["Marca", "Modelo", "Referencia"].includes(key) ||
    !/^\d{1,3}\.\d{1,2}\s+m$/u.test(value.trim())) return value;
  const metres = editorialQuantity(value, "m");
  return metres === null ? value : `${formatEditorialQuantity(metres)} m`;
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
      repeatedModel[1].trim() : normalizeMetricPresentation(key, value);
    if (formatted === value) continue;
    normalized ??= { ...specs };
    normalized[key] = formatted;
  }
  return normalized ?? specs;
};

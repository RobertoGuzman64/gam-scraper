import type { ProductRecord, SpecsMap, SpecValue } from "../../../../contracts/catalog.js";
import { editorialQuantity } from "../../../shared/editorial/domain/editorial-measurements.js";

const weightAliases = ["Peso maquina", "Peso operativo", "Peso sin carga", "Peso carretilla en vacio"] as const;

const normalizeBinaryValue = (value: SpecValue): SpecValue => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "si" || normalized === "sí") return "Sí";
  if (normalized === "no") return "No";
  return value;
};

export const normalizeManainTechnicalSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (record.providerId !== "manain") return specs;
  const weight = editorialQuantity(specs.Peso, "kg");
  const redundant = weight === null ? [] :
    weightAliases.filter((key) => editorialQuantity(specs[key], "kg") === weight);
  let normalized: Record<string, SpecValue> | null = null;
  for (const [key, value] of Object.entries(specs)) {
    const formatted = normalizeBinaryValue(value);
    if (formatted === value) continue;
    normalized ??= { ...specs };
    normalized[key] = formatted;
  }
  if (redundant.length > 0) {
    normalized ??= { ...specs };
    for (const key of redundant) delete normalized[key];
  }
  return normalized ?? specs;
};

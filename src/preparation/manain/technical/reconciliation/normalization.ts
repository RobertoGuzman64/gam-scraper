import type { ProductRecord, SpecsMap, SpecValue } from "../../../../contracts/catalog.js";
import { editorialQuantity } from "../../../shared/editorial/domain/editorial-measurements.js";

const weightAliases = ["Peso maquina", "Peso operativo", "Peso sin carga", "Peso carretilla en vacio"] as const;

export const normalizeManainTechnicalSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (record.providerId !== "manain") return specs;
  const weight = editorialQuantity(specs.Peso, "kg");
  const redundant = weight === null ? [] :
    weightAliases.filter((key) => editorialQuantity(specs[key], "kg") === weight);
  if (redundant.length === 0) return specs;
  const normalized: Record<string, SpecValue> = { ...specs };
  for (const key of redundant) delete normalized[key];
  return normalized;
};

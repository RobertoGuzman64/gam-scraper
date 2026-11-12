import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { resolveEditorialFacts } from "../../editorial/domain/editorial-facts.js";

export const reconcileHandlingFamilySpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  const facts = resolveEditorialFacts({ ...record, specs });
  if (facts?.family !== "tractor-arrastre" || facts.loadCapacityKg === null ||
    "Capacidad de arrastre" in specs) return specs;
  const capacity = specs["Capacidad de carga (kg)"];
  if (capacity === undefined) return specs;
  const { ["Capacidad de carga (kg)"]: _removed, ...remaining } = specs;
  return { ...remaining, "Capacidad de arrastre": capacity };
};

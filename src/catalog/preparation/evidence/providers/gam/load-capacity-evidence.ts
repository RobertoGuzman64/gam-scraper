import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";

const eligibleCategories = new Set(["otros", "elevacion-nueva", "carretillas-nuevas", "marcas-nuevas"]);
const explicitCapacity = /\bcapacidad\s+(?:de\s+)?(?:carga|la\s+cesta|nominal)\s*(?:m[aá]xima\s*)?(?:(?:de\s+)?hasta\s+|de\s+|:\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{2,5})\s*(kg|kilogramos?|toneladas?|t)\b/giu;
const existingCapacity = /\bcapacidad\b/iu;

const kilograms = (amount: string, unit: string): number | null => {
  const value = Number(amount.replace(/[.,](?=\d{3}(?:\D|$))/g, ""));
  const result = /^t(?:oneladas?)?$/iu.test(unit) ? value * 1000 : value;
  return Number.isInteger(result) && result >= 100 && result <= 50000 ? result : null;
};

export const recoverGamExplicitLoadCapacitySpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.providerId !== "gam" || !eligibleCategories.has(record.categoryKey) ||
    Object.keys(source).some((key) => existingCapacity.test(key))) return source;

  const text = [record.shortDescription, record.longDescription].filter((value): value is string => typeof value === "string").join(" ");
  const measures = [...text.matchAll(explicitCapacity)];
  if (measures.length === 0) return source;

  const values = measures.map((match) => kilograms(match[1] ?? "", match[2] ?? ""));
  const capacity = values[0];
  if (capacity === null || capacity === undefined || values.some((value) => value !== capacity)) return source;

  return { ...source, "Capacidad de carga (kg)": `${capacity} KG` };
};

import type { ProductRecord } from "../../../../contracts/catalog.js";
import { fold } from "../../../shared/classification/mapping/category-utils.js";

export const gamMappedCategoryContradiction = (record: ProductRecord, slug: string): boolean => {
  if (slug === "furgonetas-electricas-segunda-mano") {
    const description = fold(`${record.title ?? ""} ${record.shortDescription ?? ""} ${record.longDescription ?? ""}`);
    if (/\b(?:es un cuatriciclo|cuatriciclo electrico|cuatriciclo de carga)\b/.test(description)) return true;
  }
  const expected = /(?:^|-)diesel(?:-|$)/.test(slug) ? "diesel" :
    /(?:^|-)electric[ao]s?(?:-|$)/.test(slug) ? "electric" :
      /(?:^|-)glp(?:-|$)/.test(slug) ? "glp" : null;
  if (expected === null) return false;
  const energies = (value: string): ReadonlySet<string> => {
    const result = new Set<string>();
    const folded = fold(value);
    if (/\bdiesel\b/.test(folded)) result.add("diesel");
    if (/\belectric[ao]s?\b/.test(folded)) result.add("electric");
    if (/\b(?:glp|lpg)\b/.test(folded)) result.add("glp");
    return result;
  };
  const titleEnergy = energies(record.title ?? "");
  if (titleEnergy.size === 1 && !titleEnergy.has(expected)) return true;
  if (titleEnergy.size > 1) return true;
  for (const key of ["Tipo motor", "Motorización"]) {
    const value = record.specs?.[key];
    if (typeof value !== "string") continue;
    const alternatives = energies(value);
    if (alternatives.size === 1 && !alternatives.has(expected)) return true;
  }
  return false;
};

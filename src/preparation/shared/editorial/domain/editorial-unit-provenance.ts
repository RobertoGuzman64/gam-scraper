import type { ProductRecord } from "../../../../contracts/catalog.js";
import { sameEditorialUnit } from "./editorial-source-contract.js";
import { resolveEditorialSource } from "./editorial-source.js";
import { resolveConsistentEditorialFamily } from "./editorial-families.js";
import type { EditorialFamily } from "./editorial-families.js";

export const verifiedEditorialUnitPair = (source: ProductRecord, prepared: ProductRecord): boolean =>
  sameEditorialUnit(source, prepared) &&
  resolveEditorialSource(source) !== null && resolveEditorialSource(prepared) !== null;

export const resolvedEditorialUnitFamilies = (
  source: ProductRecord, prepared: ProductRecord
): readonly [EditorialFamily | null, EditorialFamily | null] | null => {
  if (!verifiedEditorialUnitPair(source, prepared)) return null;
  const original = resolveEditorialSource(source);
  const reconciled = resolveEditorialSource(prepared);
  if (!original || !reconciled) return null;
  const familyOf = (record: ProductRecord, clues: string): EditorialFamily | null =>
    resolveConsistentEditorialFamily(clues, record.title,
      typeof record.specs?.["Título adicional"] === "string" ? record.specs["Título adicional"] : null,
      `${record.subcategory ?? ""} | ${record.categoryName}`);
  return [familyOf(source, original.familyClues), familyOf(prepared, reconciled.familyClues)];
};

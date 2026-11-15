import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialFamilyFromSourceGeneral, resolveConsistentEditorialFamily } from "./editorial-families.js";
import { containsEditorialBrandModel } from "./editorial-identity-match.js";
import { resolveEditorialSource } from "./editorial-source.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";

const fold = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");

const sourceEnergy = (record: ProductRecord): "electrica" | "diesel" | null => {
  const values = [record.specs?.Motor, record.specs?.["Tipo motor"],
    record.specs?.["Tipo de motor"], record.specs?.Motorización].filter((value): value is string => typeof value === "string");
  if (values.length === 0) return null;
  const energies = values.map((value) => fold(value).trim());
  if (energies.some((value) => !/^(?:electrico|electrica|diesel)$/u.test(value))) return null;
  const unique = new Set(energies.map((value) => value === "diesel" ? "diesel" : "electrica"));
  return unique.size === 1 ? [...unique][0] ?? null : null;
};

export const withoutContradictoryFamilyGeneral = (record: ProductRecord): ProductRecord => {
  const description = record.longDescription?.trim();
  if (!description || !verifiedEditorialIdentity(record) || !record.brand || !record.model ||
    containsEditorialBrandModel(description, record.brand, record.model)) return record;
  const heading = /^(?:las?|los?)\s+(?:articuladas?|tijeras?|telescopicas?)\s+(electricas?|diesel)\b/u
    .exec(fold(description));
  const declared = heading?.[1]?.startsWith("electric") ? "electrica" : heading?.[1] === "diesel" ? "diesel" : null;
  const technical = sourceEnergy(record);
  if (!declared || !technical || declared === technical) return record;
  const source = resolveEditorialSource(record);
  if (!source) return record;
  const family = resolveConsistentEditorialFamily(source.familyClues, record.title,
    typeof record.specs?.["Título adicional"] === "string" ? record.specs["Título adicional"] : null,
    `${record.subcategory ?? ""} | ${record.categoryName}`);
  if (!family || family !== editorialFamilyFromSourceGeneral(description)) return record;
  return { ...record, longDescription: null };
};

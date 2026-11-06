import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "../../technical/mapping/technical.js";
import { verifiedMercaelevaUnitEvidence } from "../evidence/verified-unit-general-data.js";
import type { VerifiedUnitGeneralEvidence } from "../evidence/verified-unit-general-data.js";

const entries: ReadonlyMap<string, VerifiedUnitGeneralEvidence> = new Map(Object.entries(verifiedMercaelevaUnitEvidence));

const sameSpecs = (actual: SpecsMap | undefined, expected: SpecsMap): boolean => {
  if (!actual) return false;
  const names = Object.keys(expected);
  return Object.keys(actual).length === names.length && names.every((name) => actual[name] === expected[name]);
};

export const verifiedMercaelevaUnitGeneral = (record: ProductRecord): string | null => {
  if (!validMercaelevaTechnicalSource(record) || record.categoryKey !== "venta" ||
    (record.condition !== "Segunda mano" && (record.condition !== "Nuevo" || record.specs?.Estado !== "Nuevo")) ||
    !record.reference) return null;
  const entry = entries.get(record.reference);
  if (!entry) return null;
  const source = entry.source;
  if (record.url !== source.url || record.title !== source.title ||
    record.brand !== source.brand || record.model !== source.model ||
    record.year !== source.year || record.horometer !== source.horometer ||
    record.condition !== source.condition ||
    record.shortDescription !== source.shortDescription ||
    record.longDescription !== source.longDescription ||
    !sameSpecs(record.specs, source.specs)) return null;
  return entry.general;
};

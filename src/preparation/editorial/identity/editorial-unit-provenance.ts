import type { ProductRecord } from "../../../contracts/catalog.js";
import { sameEditorialUnit } from "../core/editorial-source-contract.js";
import { resolveEditorialLiteralTitleSource, resolveEditorialSource } from "../core/editorial-source.js";
import { resolveConsistentEditorialFamily } from "../core/editorial-families.js";
import { containsEditorialIdentity } from "./editorial-identity-match.js";
import type { EditorialFamily } from "../core/editorial-families.js";

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

export const verifiedEditorialLiteralUnitPair = (source: ProductRecord, prepared: ProductRecord): boolean => {
  const title = source.title?.trim();
  const origin = resolveEditorialLiteralTitleSource(source);
  const tokens = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase()
    .split(/[^a-z0-9]+/u).filter(Boolean).sort().join(" ");
  const sourceIdentity = `${source.brand ?? ""} ${source.model ?? ""}`;
  const preparedIdentity = `${prepared.brand ?? ""} ${prepared.model ?? ""}`;
  const sameCompound = Boolean(title && source.model && prepared.model &&
    tokens(sourceIdentity) === tokens(preparedIdentity) && tokens(title) === tokens(sourceIdentity));
  return Boolean(title && origin && origin === resolveEditorialLiteralTitleSource(prepared) &&
    source.providerId === prepared.providerId && source.reference === prepared.reference &&
    source.url === prepared.url && source.condition === prepared.condition && source.title === prepared.title &&
    source.longDescription === prepared.longDescription && source.shortDescription === prepared.shortDescription &&
    (sameCompound || ((!source.model || source.model === prepared.model) &&
    [source.brand, prepared.brand, source.model, prepared.model].every((identity) =>
      !identity || containsEditorialIdentity(title, identity)))));
};

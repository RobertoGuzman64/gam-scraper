import type { ProductRecord } from "../../../contracts/catalog.js";
import { resolveEditorialFacts } from "../core/editorial-facts.js";
import { resolveDocumentedEditorialTitle, resolveDocumentedFamilyTitle } from "./editorial-documented-title.js";
import { editorialFamilyIsMasculine, editorialFamilyName } from "../core/editorial-families.js";
import { formatEditorialQuantity, hasEditorialMillimetreUnit } from "../measurements/editorial-measurements.js";
import { sameEditorialUnit, verifiedEditorialIdentity } from "../core/editorial-source-contract.js";

export const resolvePreparedEditorialTitle = (record: ProductRecord, sourceUnitRecord: ProductRecord): string | null => {
  const documented = resolveDocumentedEditorialTitle(sourceUnitRecord);
  if (documented !== null) return documented;
  if (sourceUnitRecord.providerId === "gam" && sourceUnitRecord.shortDescription === null &&
    sourceUnitRecord.longDescription === null &&
    verifiedEditorialIdentity(sourceUnitRecord) && sameEditorialUnit(record, sourceUnitRecord) &&
    sourceUnitRecord.specs?.Marca === sourceUnitRecord.brand &&
    sourceUnitRecord.specs?.Modelo === sourceUnitRecord.model &&
    sourceUnitRecord.title?.trim()) return sourceUnitRecord.title.trim();
  const facts = resolveEditorialFacts(record);
  if (facts && sameEditorialUnit(record, sourceUnitRecord) && verifiedEditorialIdentity(sourceUnitRecord) &&
    hasEditorialMillimetreUnit(sourceUnitRecord.specs?.["Altura máxima de elevación"]) &&
    sourceUnitRecord.title?.trim()) return sourceUnitRecord.title.trim();
  if (!facts) return resolveDocumentedFamilyTitle(sourceUnitRecord, record) ??
    (record.title?.trim() || sourceUnitRecord.title?.trim() || null);
  const family = editorialFamilyName(facts.family);
  const energy = facts.energy === "eléctrica" ? editorialFamilyIsMasculine(facts.family) ? " eléctrico" : " eléctrica" :
    facts.energy === "diésel" ? " diésel" :
      facts.energy === "GLP" ? " de GLP" : facts.energy === "gasolina" ? " de gasolina" : "";
  const height = facts.workingHeightM === null ? "" :
    ` · ${formatEditorialQuantity(facts.workingHeightM)} m de trabajo`;
  return `${family[0]?.toLocaleUpperCase("es") ?? ""}${family.slice(1)}${energy} ${facts.brand} ${facts.model}${height}`;
};

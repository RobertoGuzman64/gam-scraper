import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveDocumentedEditorialTitle, resolveDocumentedFamilyTitle } from "../domain/editorial-documented-title.js";
import { editorialFamilyName } from "../domain/editorial-families.js";
import { formatEditorialQuantity } from "../domain/editorial-measurements.js";

export const resolvePreparedEditorialTitle = (record: ProductRecord, sourceUnitRecord: ProductRecord): string | null => {
  const documented = resolveDocumentedEditorialTitle(sourceUnitRecord);
  if (documented !== null) return documented;
  const facts = resolveEditorialFacts(record);
  if (!facts) return resolveDocumentedFamilyTitle(sourceUnitRecord) ??
    (record.title?.trim() || sourceUnitRecord.title?.trim() || null);
  const family = editorialFamilyName(facts.family);
  const energy = facts.energy === "eléctrica" ? " eléctrica" :
    facts.energy === "diésel" ? " diésel" :
      facts.energy === "GLP" ? " de GLP" : facts.energy === "gasolina" ? " de gasolina" : "";
  const height = facts.workingHeightM === null ? "" :
    ` · ${formatEditorialQuantity(facts.workingHeightM)} m de trabajo`;
  return `${family[0]?.toLocaleUpperCase("es") ?? ""}${family.slice(1)}${energy} ${facts.brand} ${facts.model}${height}`;
};

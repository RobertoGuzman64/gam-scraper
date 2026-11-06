import type { ImportCandidate, ImportCatalog } from "../legacy-export/contracts.js";
import { validateCommercialAttributeValue } from "../preparation/mapping/attribute-value-validation.js";
export { validateCommercialAttributeValue } from "../preparation/mapping/attribute-value-validation.js";

type Attribute = ImportCatalog["attributes"][number];
type Assignment = ImportCandidate["attributes"][number];

export type CommercialAttributeIssue = {
  readonly attributeID: number;
  readonly reason: "atributo-desconocido" | "relacion-invalida" | "atributo-duplicado" |
    "tipo-invalido" | "opcion-invalida" | "opciones-no-definidas";
  readonly value: Assignment["value"];
};

export type CommercialAttributeDecision = {
  readonly accepted: ImportCandidate["attributes"];
  readonly issues: readonly CommercialAttributeIssue[];
};


export const decideCommercialAttributes = (
  candidate: Pick<ImportCandidate, "categorySellID" | "attributes">, catalog: ImportCatalog
): CommercialAttributeDecision => {
  const category = catalog.categories.find((item) => item.id === candidate.categorySellID && item.active !== false);
  if (!category) return { accepted: [], issues: candidate.attributes.map((entry) => ({
    attributeID: entry.attributeID, value: entry.value, reason: "relacion-invalida" as const
  })) };
  const related = new Set(catalog.relations.filter((relation) =>
    relation.categoryID === category.id && relation.actived !== false).map((relation) => relation.attributeID));
  const attributes = new Map(catalog.attributes.map((attribute) => [attribute.id, attribute]));
  const seen = new Set<number>();
  const accepted: Assignment[] = [];
  const issues: CommercialAttributeIssue[] = [];
  for (const entry of candidate.attributes) {
    const attribute = attributes.get(entry.attributeID);
    const reason: CommercialAttributeIssue["reason"] | null = !attribute ? "atributo-desconocido" :
      !related.has(entry.attributeID) ? "relacion-invalida" :
      seen.has(entry.attributeID) ? "atributo-duplicado" :
      validateCommercialAttributeValue(attribute, entry.value);
    if (reason) issues.push({ attributeID: entry.attributeID, value: entry.value, reason });
    else accepted.push(entry);
    if (!reason) seen.add(entry.attributeID);
  }
  return { accepted, issues };
};

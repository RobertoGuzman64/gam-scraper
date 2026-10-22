import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCatalog, ImportCandidate } from "./contracts.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";

export const productAttributes = (record: ProductRecord, category: ImportCatalog["categories"][number] | null, catalog: ImportCatalog): {
  readonly attributes: ImportCandidate["attributes"];
  readonly missingRequired: readonly string[];
} => {
  if (!category) return { attributes: [], missingRequired: [] };
  const activeIds = new Set(catalog.relations.filter((relation) => relation.categoryID === category.id && relation.actived !== false).map((relation) => relation.attributeID));
  const result: { attributeID: number; value: string | number | boolean }[] = [];
  const missing: string[] = [];
  for (const attribute of catalog.attributes.filter((item) => activeIds.has(item.id))) {
    const normalized = resolveAttributeValue(record, attribute);
    if (normalized === null) {
      if (attribute.required) missing.push(attribute.name);
      continue;
    }
    result.push({ attributeID: attribute.id, value: normalized });
  }
  return { attributes: result, missingRequired: missing };
};


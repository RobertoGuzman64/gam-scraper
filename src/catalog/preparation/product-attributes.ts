import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCatalog, ImportCandidate } from "../legacy-export/contracts.js";
import { resolveAttribute } from "./mapping/attribute-mapping.js";
import type { AttributeResolution } from "./mapping/attribute-types.js";

export const productAttributes = (record: ProductRecord, category: ImportCatalog["categories"][number] | null, catalog: ImportCatalog): {
  readonly attributes: ImportCandidate["attributes"];
  readonly missingRequired: readonly string[];
  readonly qualityIssues: readonly string[];
  readonly missingRequiredDetails: readonly {
    readonly attributeID: number;
    readonly name: string;
    readonly status: Exclude<AttributeResolution["status"], "resolved">;
  }[];
} => {
  if (!category) return { attributes: [], missingRequired: [], qualityIssues: [], missingRequiredDetails: [] };
  const activeIds = new Set(catalog.relations.filter((relation) => relation.categoryID === category.id && relation.actived !== false).map((relation) => relation.attributeID));
  const result: { attributeID: number; value: string | number | boolean }[] = [];
  const missing: string[] = [];
  const qualityIssues: string[] = [];
  const missingDetails: { attributeID: number; name: string; status: Exclude<AttributeResolution["status"], "resolved"> }[] = [];
  for (const attribute of catalog.attributes.filter((item) => activeIds.has(item.id))) {
    const resolution = resolveAttribute(record, attribute);
    if (resolution.status !== "resolved") {
      if (resolution.status === "contradiction") qualityIssues.push(`Atributo contradictorio: ${attribute.name}`);
      if (resolution.status === "invalid") qualityIssues.push(`Atributo no normalizable: ${attribute.name}`);
      if (resolution.status === "rejected") qualityIssues.push(`Atributo rechazado por seguridad: ${attribute.name}`);
      if (attribute.required) {
        missing.push(attribute.name);
        missingDetails.push({ attributeID: attribute.id, name: attribute.name, status: resolution.status });
      }
      continue;
    }
    result.push({ attributeID: attribute.id, value: resolution.value });
  }
  return { attributes: result, missingRequired: missing, qualityIssues, missingRequiredDetails: missingDetails };
};


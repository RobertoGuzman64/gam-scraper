import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate, ImportCatalog } from "../legacy-export/contracts.js";
import { resolveAttribute } from "../../preparation/shared/classification/mapping/attribute-mapping.js";
import { validateCommercialAttributeValue } from "../../preparation/shared/classification/mapping/attribute-value-validation.js";

export type CommercialAttributeObservation = {
  readonly attributeID: number;
  readonly status: "accepted" | "resuelto-no-asignado" | "sin-intervencion";
};

export const observeCommercialAttributes = (
  source: ProductRecord, categorySellID: number,
  accepted: ImportCandidate["attributes"], catalog: ImportCatalog
): readonly CommercialAttributeObservation[] => {
  const values = new Set(accepted.map((item) => item.attributeID));
  const attributes = new Map(catalog.attributes.map((attribute) => [attribute.id, attribute]));
  const observations: CommercialAttributeObservation[] = [];
  const observed = new Set<number>();
  for (const relation of catalog.relations) {
    if (relation.categoryID !== categorySellID || relation.actived === false) continue;
    const attribute = attributes.get(relation.attributeID);
    if (!attribute || observed.has(attribute.id)) continue;
    observed.add(attribute.id);
    let status: CommercialAttributeObservation["status"] = "sin-intervencion";
    if (values.has(attribute.id)) status = "accepted";
    else {
      const resolution = resolveAttribute(source, attribute);
      if (resolution.status === "resolved" && validateCommercialAttributeValue(attribute, resolution.value) === null) {
        status = "resuelto-no-asignado";
      }
    }
    observations.push({ attributeID: attribute.id, status });
  }
  return observations;
};

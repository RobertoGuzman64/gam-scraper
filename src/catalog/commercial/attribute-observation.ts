import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate, ImportCatalog } from "../legacy-export/contracts.js";
import { resolveAttribute } from "../preparation/mapping/attribute-mapping.js";

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
  for (const relation of catalog.relations) {
    if (relation.categoryID !== categorySellID || relation.actived === false) continue;
    const attribute = attributes.get(relation.attributeID);
    if (!attribute) continue;
    let status: CommercialAttributeObservation["status"] = "sin-intervencion";
    if (values.has(attribute.id)) status = "accepted";
    else {
      const resolution = resolveAttribute(source, attribute);
      if (resolution.status === "resolved") status = "resuelto-no-asignado";
    }
    observations.push({ attributeID: attribute.id, status });
  }
  return observations;
};

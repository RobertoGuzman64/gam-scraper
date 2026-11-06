import type { ImportCandidate, ImportCatalog } from "../legacy-export/contracts.js";
import { fold } from "../../preparation/shared/classification/mapping/attribute-utils.js";
import { decideCommercialAttributes } from "./attribute-decision.js";
import type { CommercialAttributeDecision } from "./attribute-decision.js";

type Assignment = ImportCandidate["attributes"][number];

type CommercialAttributeProjection = CommercialAttributeDecision & {
  readonly recovered: readonly Assignment[];
};

const eligibleTyre = (published: ImportCandidate, proposed: ImportCandidate, catalog: ImportCatalog): Assignment | null => {
  if (published.providerId !== "gam" || proposed.providerId !== published.providerId ||
    proposed.sourceUrl !== published.sourceUrl || proposed.reference !== published.reference ||
    proposed.categorySellID === null || proposed.attributes.some((entry) => entry.attributeID === 24) ||
    published.spec["Neumáticos"] !== undefined) return null;
  const attribute = catalog.attributes.find((entry) => entry.id === 24 && entry.name === "Neumáticos" && entry.type === "SELECT");
  if (!attribute || !catalog.relations.some((relation) => relation.categoryID === proposed.categorySellID &&
    relation.attributeID === attribute.id && relation.actived !== false)) return null;
  const raw = published.spec["Ruedas"];
  if (typeof raw !== "string") return null;
  const value = fold(raw);
  const normalized = value === "macizas" || value === "macizos" ? "Macizos" :
    ["superelasticas", "super elasticas", "superelasticos", "super elasticos"].includes(value) ? "Superelásticos" : null;
  if (!normalized || !attribute.unit_option.split(/\s+\/\s+/).some((option) => fold(option) === fold(normalized))) return null;
  return { attributeID: attribute.id, value: normalized };
};

export const projectCommercialAttributes = (
  published: ImportCandidate, proposed: ImportCandidate, catalog: ImportCatalog
): CommercialAttributeProjection => {
  const candidate = eligibleTyre(published, proposed, catalog);
  const result = decideCommercialAttributes({ categorySellID: proposed.categorySellID,
    attributes: candidate ? [...proposed.attributes, candidate] : proposed.attributes }, catalog);
  const recovered = candidate && result.accepted.some((item) => item.attributeID === candidate.attributeID && item.value === candidate.value)
    ? [candidate] : [];
  return { ...result, recovered };
};

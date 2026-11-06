import type { ProductRecord } from "../contracts/catalog.js";
import type { ImportCandidate } from "../commercial/legacy-export/contracts.js";
import { gamConditionEvidence } from "./gam/classification/mapping/condition.js";
import { mercaelevaConditionEvidence } from "./mercaeleva/classification/mapping/condition.js";
import { manainConditionEvidence } from "./manain/classification/mapping/condition.js";
import { isGomarizOccasionSale } from "../catalog/normalization/gomariz/sale.js";

export const resolveCommercialCondition = (record: ProductRecord): { readonly condition: ImportCandidate["condition"]; readonly contradictory: boolean } => {
  const gam = gamConditionEvidence(record);
  const mercaeleva = mercaelevaConditionEvidence(record);
  const manain = manainConditionEvidence(record);
  const gomarizUsed = record.providerId === "gomariz" &&
    isGomarizOccasionSale(record.url, record.categoryKey, record.categoryName) &&
    new URL(record.url).pathname.split("/").filter(Boolean).length === 4;
  const newEvidence = record.condition === "Nuevo" || gam.isNew || mercaeleva.isNew || manain.isNew;
  const usedEvidence = record.condition === "Segunda mano" || gam.isUsed || mercaeleva.isUsed || manain.isUsed || gomarizUsed;
  const contradictoryCondition = newEvidence && usedEvidence;
  const condition: ImportCandidate["condition"] = contradictoryCondition ? null :
    record.condition === "Nuevo" || mercaeleva.isNew || manain.isNew ? "Nuevo" :
      record.condition === "Segunda mano" || gam.documentedUsed || mercaeleva.isUsed || manain.isUsed || gomarizUsed ? "Segunda_Mano" : null;
  return { condition, contradictory: contradictoryCondition };
};

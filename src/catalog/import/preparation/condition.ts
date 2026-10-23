import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "./contracts.js";
import { gamConditionEvidence } from "../mapping/providers/gam/condition.js";
import { mercaelevaConditionEvidence } from "../mapping/providers/mercaeleva/condition.js";
import { isGomarizOccasionSale } from "../../normalization/gomariz-sale.js";

export const resolveCommercialCondition = (record: ProductRecord): { readonly condition: ImportCandidate["condition"]; readonly contradictory: boolean } => {
  const gam = gamConditionEvidence(record);
  const mercaeleva = mercaelevaConditionEvidence(record);
  const gomarizUsed = record.providerId === "gomariz" &&
    isGomarizOccasionSale(record.url, record.categoryKey, record.categoryName) &&
    new URL(record.url).pathname.split("/").filter(Boolean).length === 4;
  const newEvidence = record.condition === "Nuevo" || gam.isNew || mercaeleva.isNew;
  const usedEvidence = record.condition === "Segunda mano" || gam.isUsed || mercaeleva.isUsed || gomarizUsed;
  const contradictoryCondition = newEvidence && usedEvidence;
  const condition: ImportCandidate["condition"] = contradictoryCondition ? null :
    record.condition === "Nuevo" || mercaeleva.isNew ? "Nuevo" :
      record.condition === "Segunda mano" || gam.documentedUsed || mercaeleva.isUsed || gomarizUsed ? "Segunda_Mano" : null;
  return { condition, contradictory: contradictoryCondition };
};

import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "./contracts.js";
import { gamConditionEvidence } from "../mapping/providers/gam/condition.js";
import { mercaelevaConditionEvidence } from "../mapping/providers/mercaeleva/condition.js";

export const resolveCommercialCondition = (record: ProductRecord): { readonly condition: ImportCandidate["condition"]; readonly contradictory: boolean } => {
  const gam = gamConditionEvidence(record);
  const mercaeleva = mercaelevaConditionEvidence(record);
  const newEvidence = record.condition === "Nuevo" || gam.isNew || mercaeleva.isNew;
  const usedEvidence = record.condition === "Segunda mano" || gam.isUsed || mercaeleva.isUsed;
  const contradictoryCondition = newEvidence && usedEvidence;
  const condition: ImportCandidate["condition"] = contradictoryCondition ? null :
    record.condition === "Nuevo" || mercaeleva.isNew ? "Nuevo" :
      record.condition === "Segunda mano" || mercaeleva.isUsed ? "Segunda_Mano" : null;
  return { condition, contradictory: contradictoryCondition };
};

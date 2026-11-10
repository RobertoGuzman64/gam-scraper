import type { ProductRecord } from "../contracts/catalog.js";
import type { ImportCandidate } from "../commercial/legacy-export/contracts.js";
import { classificationProvider } from "./shared/classification/mapping/classification-provider.js";

export const resolveCommercialCondition = (record: ProductRecord): { readonly condition: ImportCandidate["condition"]; readonly contradictory: boolean } => {
  const evidence = classificationProvider(record)?.condition(record);
  const newEvidence = record.condition === "Nuevo" || evidence?.isNew === true;
  const usedEvidence = record.condition === "Segunda mano" || evidence?.isUsed === true;
  const contradictoryCondition = newEvidence && usedEvidence;
  const condition: ImportCandidate["condition"] = contradictoryCondition ? null :
    record.condition === "Nuevo" || evidence?.resolvesNew === true ? "Nuevo" :
      record.condition === "Segunda mano" || evidence?.resolvesUsed === true ? "Segunda_Mano" : null;
  return { condition, contradictory: contradictoryCondition };
};

import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { recoverMercaelevaSourceFuel } from "./source-fuel-evidence.js";
import { recoverMercaelevaDocumentedPlatformTechnicalSpecs } from "./documented-platform-technical-specs.js";
import { recoverMercaelevaDocumentedEquipmentTechnicalSpecs } from "./documented-equipment-technical-specs.js";

export const recoverMercaelevaDocumentedSourceSpecs = (record: ProductRecord, specs: SpecsMap): { sourceFuelSpecs: SpecsMap; documentedSpecs: SpecsMap } => {
  const sourceFuelSpecs = recoverMercaelevaSourceFuel(record, specs);
  const platformSpecs = recoverMercaelevaDocumentedPlatformTechnicalSpecs(record, sourceFuelSpecs);
  return { sourceFuelSpecs, documentedSpecs: recoverMercaelevaDocumentedEquipmentTechnicalSpecs(record, platformSpecs) };
};

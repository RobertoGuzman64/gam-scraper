import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import type { TechnicalRecoveryObservation } from "../../../provenance/technical-recovery-observation.js";
import { recoverMercaelevaSourceFuel } from "../source-fuel-evidence.js";
import { recoverMercaelevaDocumentedPlatformTechnicalSpecs } from "./documented-platform-technical-specs.js";
import { recoverMercaelevaDocumentedEquipmentTechnicalSpecs } from "./documented-equipment-technical-specs.js";
import { reconcileMercaelevaVerifiedJlg450AjBaseModel } from "../../technical/mercaeleva-jlg-450aj.js";

export const recoverMercaelevaDocumentedSourceSpecs = (
  record: ProductRecord, specs: SpecsMap, observe?: TechnicalRecoveryObservation
): { sourceFuelSpecs: SpecsMap; documentedSpecs: SpecsMap } => {
  const sourceFuelSpecs = recoverMercaelevaSourceFuel(record, specs);
  observe?.(specs, sourceFuelSpecs, "src/preparation/mercaeleva/technical/evidence/source-fuel-evidence.ts", "longDescription");
  const platformSpecs = recoverMercaelevaDocumentedPlatformTechnicalSpecs(
    reconcileMercaelevaVerifiedJlg450AjBaseModel(record), sourceFuelSpecs, observe
  );
  const documentedSpecs = recoverMercaelevaDocumentedEquipmentTechnicalSpecs(record, platformSpecs, observe);
  return { sourceFuelSpecs, documentedSpecs };
};

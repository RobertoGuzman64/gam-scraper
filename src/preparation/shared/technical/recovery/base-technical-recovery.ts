import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import type { TechnicalRecoveryObservation } from "../../../technical-recovery-observation.js";
import { recoverGamStabilizedTechnicalSpecs } from "../../../gam/technical/gam-technical-recovery.js";
import { recoverGomarizSourceYearSpec } from "../../../gomariz/technical/mapping/source-year-spec.js";
import { recoverGamCrossedTechnicalSpecs } from "../../../gam/technical/crossed-specifications.js";

export const recoverBaseTechnicalSpecs = (
  record: ProductRecord, sourceUnitRecord: ProductRecord, observe?: TechnicalRecoveryObservation
): SpecsMap => {
  const stabilizedSpecs = recoverGamStabilizedTechnicalSpecs(record, sourceUnitRecord, observe);
  const sourceYearSpecs = recoverGomarizSourceYearSpec(record, stabilizedSpecs);
  observe?.(stabilizedSpecs, sourceYearSpecs, "src/preparation/gomariz/technical/mapping/source-year-spec.ts");
  const crossedSpecs = recoverGamCrossedTechnicalSpecs({ ...record, specs: sourceYearSpecs }, observe);
  return crossedSpecs;
};

import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { recoverGamStabilizedTechnicalSpecs } from "../../../gam/technical/gam-technical-recovery.js";
import { recoverGomarizSourceYearSpec } from "../../../gomariz/technical/mapping/source-year-spec.js";
import { recoverGamCrossedTechnicalSpecs } from "../../../gam/technical/crossed-specifications.js";

export const recoverBaseTechnicalSpecs = (record: ProductRecord, sourceUnitRecord: ProductRecord): SpecsMap => {
  const stabilizedSpecs = recoverGamStabilizedTechnicalSpecs(record, sourceUnitRecord);
  const sourceYearSpecs = recoverGomarizSourceYearSpec(record, stabilizedSpecs);
  return recoverGamCrossedTechnicalSpecs({ ...record, specs: sourceYearSpecs });
};

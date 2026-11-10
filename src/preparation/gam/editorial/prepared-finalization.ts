import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { resolveGamVerifiedUnitSourceGeneral } from "./source/verified-unit-source-general.js";
import { resolveGamVerifiedSourceMatchedGeneral } from "./source/verified-source-matched-general.js";
import { includeGamRegenerativeBrakingInGeneral } from "./source/source-regenerative-braking-general.js";
import { includeGamSourceUnitDetailsInGeneral } from "./source/source-unit-details-general.js";
import { includeGamSourceGradeabilityInGeneral } from "./source/source-gradeability-general.js";
import { includeGamSourceDeclaredWeightInGeneral } from "./source/source-declared-weight-general.js";
import { includeGamSourceSafetyControlsInGeneral } from "./source/source-safety-controls-general.js";
import { includeGamSourceBatteryVoltageInGeneral } from "./source/source-battery-voltage-general.js";
import { includeGamSourceMachineDimensionsInGeneral } from "./source/source-machine-dimensions-general.js";
import { includeGamSourceForkliftMeasuresInGeneral } from "./source/source-forklift-measures-general.js";

export const includeGamPreparedSourceDetails = (
  record: ProductRecord,
  sourceUnitRecord: ProductRecord,
  sourceYearGeneral: string | null,
  sourceFuelSpecs: SpecsMap
) => {
  const sourcedBrakingGeneral = includeGamRegenerativeBrakingInGeneral(record, sourceYearGeneral, sourceFuelSpecs);
  const sourcedUnitGeneral = includeGamSourceUnitDetailsInGeneral(sourceUnitRecord, sourcedBrakingGeneral, sourceFuelSpecs);
  const sourcedGradeabilityGeneral = includeGamSourceGradeabilityInGeneral(sourceUnitRecord, sourcedUnitGeneral, sourceFuelSpecs);
  const sourcedWeightGeneral = includeGamSourceDeclaredWeightInGeneral(sourceUnitRecord, sourcedGradeabilityGeneral, sourceFuelSpecs);
  const sourcedSafetyGeneral = includeGamSourceSafetyControlsInGeneral(sourceUnitRecord, sourcedWeightGeneral, sourceFuelSpecs);
  const sourcedDimensionsGeneral = includeGamSourceMachineDimensionsInGeneral(sourceUnitRecord, sourcedSafetyGeneral, sourceFuelSpecs);
  const sourcedForkliftGeneral = includeGamSourceForkliftMeasuresInGeneral(sourceUnitRecord, sourcedDimensionsGeneral, sourceFuelSpecs);
  const sourcedBatteryGeneral = includeGamSourceBatteryVoltageInGeneral(sourceUnitRecord, sourcedForkliftGeneral, sourceFuelSpecs);
  return resolveGamVerifiedUnitSourceGeneral(record, sourcedBatteryGeneral) ?? sourcedBatteryGeneral;
};

export const resolveGamPreparedSourceMatchedGeneral = resolveGamVerifiedSourceMatchedGeneral;

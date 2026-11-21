import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";
import { recoverGamExplicitWorkHeightSpec } from "../../preparation/gam/technical/measurements/work-height-evidence.js";
import { recoverGamExplicitMachineSpecs } from "../../preparation/gam/technical/measurements/measured-machine-specs.js";
import { recoverGamVerifiedTechnicalSpecs } from "../../preparation/gam/technical/measurements/verified-technical-measures.js";
import { recoverGamBatteryMeasures } from "../../preparation/gam/technical/energy/battery-measures-evidence.js";
import { recoverGamElectricMotorPowerSpecs } from "../../preparation/gam/technical/energy/electric-motor-power-evidence.js";
import { recoverGamOperationalSpecs } from "../../preparation/gam/technical/measurements/operational-measures-evidence.js";
import { recoverGamCleaningTankSpecs } from "../../preparation/gam/technical/operations/cleaning-tank-evidence.js";
import { recoverGamVerifiedUnitPerformanceSpecs } from "../../preparation/gam/technical/operations/verified-unit-performance-specs.js";
import { recoverGamPhysicalMeasures } from "../../preparation/gam/technical/measurements/physical-measures-evidence.js";
import { recoverGamClearanceAndPlatform } from "../../preparation/gam/technical/measurements/clearance-platform-evidence.js";
import { recoverGamAutonomySpec } from "../../preparation/gam/technical/energy/autonomy-evidence.js";
import { recoverGamMaximumLiftHeightSpec } from "../../preparation/gam/technical/measurements/lift-height-evidence.js";
import { recoverGamVerifiedDrivetrainBrakes } from "../../preparation/gam/technical/mobility/verified-drivetrain-brakes-evidence.js";
import { recoverGamVerifiedSteeringBraking } from "../../preparation/gam/technical/mobility/verified-steering-braking-evidence.js";
import { recoverGamVerifiedUnitGeometrySpecs } from "../../preparation/gam/technical/measurements/verified-unit-geometry-specs.js";
import { recoverGamVerifiedUnitOperationSpecs } from "../../preparation/gam/technical/operations/verified-unit-operation-specs.js";
import { recoverGamLithiumBatteryType } from "../../preparation/gam/technical/energy/battery-chemistry-evidence.js";
import { recoverGamExplicitHorizontalReachSpec } from "../../preparation/gam/technical/measurements/reach-evidence.js";
import { recoverGamWheelbaseSpec } from "../../preparation/gam/technical/mobility/wheelbase-evidence.js";
import { recoverGamVerifiedTyreDimensions } from "../../preparation/gam/technical/mobility/verified-tyre-dimensions-evidence.js";
import { recoverGamScrubbingPressureSpec } from "../../preparation/gam/technical/operations/scrubbing-pressure-evidence.js";
import { recoverGamCleaningWorkingWidthSpec } from "../../preparation/gam/technical/operations/cleaning-productivity-evidence.js";
import { compareTechnicalFields } from "./field-differences.js";
import { isGamUnitUrl } from "./source-year-evidence.js";

type SourceTechnicalEvidence = {
  readonly sourceField: "longDescription";
  readonly sourceValue: string;
  readonly mechanism: string;
};

const sourceRecoveries: readonly {
  readonly path: string;
  readonly recover: (record: ProductRecord) => SpecsMap;
}[] = [
  {
    path: "src/preparation/gam/technical/measurements/work-height-evidence.ts",
    recover: recoverGamExplicitWorkHeightSpec
  },
  {
    path: "src/preparation/gam/technical/measurements/measured-machine-specs.ts",
    recover: recoverGamExplicitMachineSpecs
  },
  {
    path: "src/preparation/gam/technical/measurements/verified-technical-measures.ts",
    recover: recoverGamVerifiedTechnicalSpecs
  },
  {
    path: "src/preparation/gam/technical/energy/battery-measures-evidence.ts",
    recover: recoverGamBatteryMeasures
  },
  {
    path: "src/preparation/gam/technical/energy/electric-motor-power-evidence.ts",
    recover: recoverGamElectricMotorPowerSpecs
  },
  {
    path: "src/preparation/gam/technical/measurements/operational-measures-evidence.ts",
    recover: recoverGamOperationalSpecs
  },
  {
    path: "src/preparation/gam/technical/operations/cleaning-tank-evidence.ts",
    recover: recoverGamCleaningTankSpecs
  },
  {
    path: "src/preparation/gam/technical/operations/verified-unit-performance-specs.ts",
    recover: recoverGamVerifiedUnitPerformanceSpecs
  }
];

const additionalRecoveries: typeof sourceRecoveries = [
  {
    path: "src/preparation/gam/technical/measurements/physical-measures-evidence.ts",
    recover: recoverGamPhysicalMeasures
  },
  {
    path: "src/preparation/gam/technical/measurements/clearance-platform-evidence.ts",
    recover: recoverGamClearanceAndPlatform
  },
  {
    path: "src/preparation/gam/technical/energy/autonomy-evidence.ts",
    recover: recoverGamAutonomySpec
  },
  {
    path: "src/preparation/gam/technical/measurements/lift-height-evidence.ts",
    recover: recoverGamMaximumLiftHeightSpec
  },
  {
    path: "src/preparation/gam/technical/mobility/verified-drivetrain-brakes-evidence.ts",
    recover: recoverGamVerifiedDrivetrainBrakes
  },
  {
    path: "src/preparation/gam/technical/mobility/verified-steering-braking-evidence.ts",
    recover: recoverGamVerifiedSteeringBraking
  },
  {
    path: "src/preparation/gam/technical/measurements/verified-unit-geometry-specs.ts",
    recover: recoverGamVerifiedUnitGeometrySpecs
  },
  {
    path: "src/preparation/gam/technical/operations/verified-unit-operation-specs.ts",
    recover: recoverGamVerifiedUnitOperationSpecs
  },
  {
    path: "src/preparation/gam/technical/energy/battery-chemistry-evidence.ts",
    recover: recoverGamLithiumBatteryType
  },
  {
    path: "src/preparation/gam/technical/measurements/reach-evidence.ts",
    recover: recoverGamExplicitHorizontalReachSpec
  },
  {
    path: "src/preparation/gam/technical/mobility/wheelbase-evidence.ts",
    recover: recoverGamWheelbaseSpec
  },
  {
    path: "src/preparation/gam/technical/mobility/verified-tyre-dimensions-evidence.ts",
    recover: recoverGamVerifiedTyreDimensions
  },
  {
    path: "src/preparation/gam/technical/operations/scrubbing-pressure-evidence.ts",
    recover: recoverGamScrubbingPressureSpec
  },
  {
    path: "src/preparation/gam/technical/operations/cleaning-productivity-evidence.ts",
    recover: recoverGamCleaningWorkingWidthSpec
  }
];

export const sourceTechnicalEvidence = (
  original: ProductRecord, field: string, value: string | null
): SourceTechnicalEvidence | null => {
  if (value === null || !original.longDescription?.trim() || !isGamUnitUrl(original)) return null;
  const matchesWith = (recoveries: typeof sourceRecoveries): typeof sourceRecoveries =>
    recoveries.filter(({ recover }) =>
      compareTechnicalFields(original.specs ?? {}, recover(original))
        .some((difference) => difference.group === "technical" && difference.change === "added" &&
          difference.field === field && difference.after === value));
  const previous = matchesWith(sourceRecoveries);
  const matches = previous.length === 0 ? matchesWith(additionalRecoveries) : previous;
  if (matches.length !== 1 || !matches[0]) return null;
  return {
    sourceField: "longDescription", sourceValue: original.longDescription,
    mechanism: matches[0].path
  };
};

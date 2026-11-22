import { createHash } from "node:crypto";
import { originalRecordFingerprint } from "../catalog/identity-fingerprint.js";
import { reconcileGamVerifiedListing } from "./gam/technical/models/gam-verified-listing-reconciliation.js";
import type { ProductRecord, SpecsMap } from "../contracts/catalog.js";
import { recoverGamExplicitWorkHeightSpec } from "./gam/technical/measurements/work-height-evidence.js";
import { recoverGamExplicitMachineSpecs } from "./gam/technical/measurements/measured-machine-specs.js";
import { recoverGamVerifiedTechnicalSpecs } from "./gam/technical/measurements/verified-technical-measures.js";
import { recoverGamBatteryMeasures } from "./gam/technical/energy/battery-measures-evidence.js";
import { recoverGamElectricMotorPowerSpecs } from "./gam/technical/energy/electric-motor-power-evidence.js";
import { recoverGamOperationalSpecs } from "./gam/technical/measurements/operational-measures-evidence.js";
import { recoverGamCleaningTankSpecs } from "./gam/technical/operations/cleaning-tank-evidence.js";
import { recoverGamVerifiedUnitPerformanceSpecs } from "./gam/technical/operations/verified-unit-performance-specs.js";
import { recoverGamPhysicalMeasures } from "./gam/technical/measurements/physical-measures-evidence.js";
import { recoverGamClearanceAndPlatform } from "./gam/technical/measurements/clearance-platform-evidence.js";
import { recoverGamAutonomySpec } from "./gam/technical/energy/autonomy-evidence.js";
import { recoverGamMaximumLiftHeightSpec } from "./gam/technical/measurements/lift-height-evidence.js";
import { recoverGamVerifiedDrivetrainBrakes } from "./gam/technical/mobility/verified-drivetrain-brakes-evidence.js";
import { recoverGamVerifiedSteeringBraking } from "./gam/technical/mobility/verified-steering-braking-evidence.js";
import { recoverGamVerifiedUnitGeometrySpecs } from "./gam/technical/measurements/verified-unit-geometry-specs.js";
import { recoverGamVerifiedUnitOperationSpecs } from "./gam/technical/operations/verified-unit-operation-specs.js";
import { recoverGamLithiumBatteryType } from "./gam/technical/energy/battery-chemistry-evidence.js";
import { recoverGamExplicitHorizontalReachSpec } from "./gam/technical/measurements/reach-evidence.js";
import { recoverGamWheelbaseSpec } from "./gam/technical/mobility/wheelbase-evidence.js";
import { recoverGamVerifiedVariantAcoustics } from "./gam/identity/evidence/variant-acoustics-evidence.js";
import { recoverGamVerifiedTyreDimensions } from "./gam/technical/mobility/verified-tyre-dimensions-evidence.js";
import { recoverGamScrubbingPressureSpec } from "./gam/technical/operations/scrubbing-pressure-evidence.js";
import { recoverGamCleaningWorkingWidthSpec } from "./gam/technical/operations/cleaning-productivity-evidence.js";
import { normalizeSpecKey } from "../catalog/normalization/normalize-specs.js";
import { isGamUnitUrl } from "./technical-source-year-evidence.js";

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
    path: "src/preparation/gam/identity/evidence/variant-acoustics-evidence.ts",
    recover: recoverGamVerifiedVariantAcoustics
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
    recoveries.filter(({ recover }) => {
      if (Object.keys(original.specs ?? {}).some((key) => normalizeSpecKey(key) === field)) return false;
      const matching = Object.entries(recover(original)).filter(([key]) => normalizeSpecKey(key) === field);
      if (matching.length !== 1) return false;
      const recovered = matching[0]?.[1];
      return recovered !== undefined && (typeof recovered === "string" ? recovered : JSON.stringify(recovered)) === value;
    });
  const previous = matchesWith(sourceRecoveries);
  const matches = previous.length === 0 ? matchesWith(additionalRecoveries) : previous;
  if (matches.length !== 1 || !matches[0]) return null;
  return {
    sourceField: "longDescription", sourceValue: original.longDescription,
    mechanism: matches[0].path
  };
};

export const verifiedReconciledSourceTechnicalRule = (
  original: ProductRecord, field: string, value: string, mechanism: string
): string | null => {
  const corrected = reconcileGamVerifiedListing(original);
  if (corrected === original || corrected.longDescription === original.longDescription ||
    sourceTechnicalEvidence(original, field, value) !== null) return null;
  const evidence = sourceTechnicalEvidence(corrected, field, value);
  if (evidence?.mechanism !== mechanism || evidence.sourceValue !== corrected.longDescription) return null;
  return createHash("sha256").update(JSON.stringify([
    "verified-listing", original.providerId, original.reference, original.url,
    originalRecordFingerprint(original), mechanism, field, value
  ])).digest("hex");
};

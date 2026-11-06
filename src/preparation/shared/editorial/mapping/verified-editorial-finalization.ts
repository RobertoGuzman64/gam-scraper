import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { resolveMercaelevaVerifiedSourceEditorial } from "../../../mercaeleva/editorial/mapping/verified-source-editorial.js";
import { resolveGamVerifiedUnitSourceGeneral } from "../../../gam/editorial/source/verified-unit-source-general.js";
import { resolveVerifiedCanonicalBriefEditorial } from "./verified-canonical-brief-editorial.js";
import { applyVerifiedEditorialComposition } from "./verified-editorial-composition.js";
import { resolveVerifiedUnitSummaryEditorial } from "./verified-unit-summary-editorial.js";
import { resolveGomarizVerifiedModelGeneral } from "../../../gomariz/editorial/mapping/verified-model-general.js";
import { resolveGamVerifiedSourceMatchedGeneral } from "../../../gam/editorial/source/verified-source-matched-general.js";
import { includeSourceYearInGeneral } from "./source-year-general.js";
import { includeGamRegenerativeBrakingInGeneral } from "../../../gam/editorial/source/source-regenerative-braking-general.js";
import { includeGamSourceUnitDetailsInGeneral } from "../../../gam/editorial/source/source-unit-details-general.js";
import { includeGamSourceGradeabilityInGeneral } from "../../../gam/editorial/source/source-gradeability-general.js";
import { includeGamSourceDeclaredWeightInGeneral } from "../../../gam/editorial/source/source-declared-weight-general.js";
import { includeGamSourceSafetyControlsInGeneral } from "../../../gam/editorial/source/source-safety-controls-general.js";
import { includeGamSourceBatteryVoltageInGeneral } from "../../../gam/editorial/source/source-battery-voltage-general.js";
import { includeGamSourceMachineDimensionsInGeneral } from "../../../gam/editorial/source/source-machine-dimensions-general.js";
import { includeGamSourceForkliftMeasuresInGeneral } from "../../../gam/editorial/source/source-forklift-measures-general.js";

export const finalizePreparedEditorial = (
  record: ProductRecord,
  sourceUnitRecord: ProductRecord,
  preparedShort: string | null,
  preparedLong: string | null,
  sourceFuelSpecs: SpecsMap,
  allowVerifiedEnrichment: boolean
) => {
  const sourceYearGeneral = allowVerifiedEnrichment ? includeSourceYearInGeneral(record, preparedLong, preparedShort, sourceFuelSpecs) : preparedLong;
  const sourcedBrakingGeneral = allowVerifiedEnrichment
    ? includeGamRegenerativeBrakingInGeneral(record, sourceYearGeneral, sourceFuelSpecs) : sourceYearGeneral;
  const sourcedUnitGeneral = allowVerifiedEnrichment
    ? includeGamSourceUnitDetailsInGeneral(sourceUnitRecord, sourcedBrakingGeneral, sourceFuelSpecs) : sourcedBrakingGeneral;
  const sourcedGradeabilityGeneral = allowVerifiedEnrichment
    ? includeGamSourceGradeabilityInGeneral(sourceUnitRecord, sourcedUnitGeneral, sourceFuelSpecs) : sourcedUnitGeneral;
  const sourcedWeightGeneral = allowVerifiedEnrichment
    ? includeGamSourceDeclaredWeightInGeneral(sourceUnitRecord, sourcedGradeabilityGeneral, sourceFuelSpecs) : sourcedGradeabilityGeneral;

  const sourcedSafetyGeneral = allowVerifiedEnrichment
    ? includeGamSourceSafetyControlsInGeneral(sourceUnitRecord, sourcedWeightGeneral, sourceFuelSpecs) : sourcedWeightGeneral;

  const sourcedDimensionsGeneral = allowVerifiedEnrichment
    ? includeGamSourceMachineDimensionsInGeneral(sourceUnitRecord, sourcedSafetyGeneral, sourceFuelSpecs) : sourcedSafetyGeneral;

  const sourcedForkliftGeneral = allowVerifiedEnrichment
    ? includeGamSourceForkliftMeasuresInGeneral(sourceUnitRecord, sourcedDimensionsGeneral, sourceFuelSpecs) : sourcedDimensionsGeneral;

  const sourcedBatteryGeneral = allowVerifiedEnrichment
    ? includeGamSourceBatteryVoltageInGeneral(sourceUnitRecord, sourcedForkliftGeneral, sourceFuelSpecs) : sourcedForkliftGeneral;
  const verifiedSourceGeneral = allowVerifiedEnrichment
    ? resolveGamVerifiedUnitSourceGeneral(record, sourcedBatteryGeneral) ?? sourcedBatteryGeneral : sourcedBatteryGeneral;
  const verifiedEditorialGeneral = allowVerifiedEnrichment
    ? resolveMercaelevaVerifiedSourceEditorial(sourceUnitRecord, verifiedSourceGeneral) ?? verifiedSourceGeneral : verifiedSourceGeneral;
  const canonicalBriefGeneral = allowVerifiedEnrichment
    ? resolveVerifiedCanonicalBriefEditorial(sourceUnitRecord, verifiedEditorialGeneral) ?? verifiedEditorialGeneral : verifiedEditorialGeneral;
  const verifiedDescriptions = applyVerifiedEditorialComposition(
    sourceUnitRecord, preparedShort, canonicalBriefGeneral, allowVerifiedEnrichment
  );

  const verifiedModelGeneral = allowVerifiedEnrichment
    ? resolveGomarizVerifiedModelGeneral(sourceUnitRecord, verifiedDescriptions.general) : null;
  const verifiedResidualGeneral = allowVerifiedEnrichment
    ? resolveGamVerifiedSourceMatchedGeneral(sourceUnitRecord, verifiedModelGeneral ?? verifiedDescriptions.general) : null;
  const verifiedUnitSummary = allowVerifiedEnrichment
    ? resolveVerifiedUnitSummaryEditorial(sourceUnitRecord, verifiedDescriptions.short, verifiedDescriptions.general) : null;

  return {
    short: verifiedUnitSummary ?? verifiedDescriptions.short,
    general: verifiedResidualGeneral ?? verifiedModelGeneral ?? verifiedDescriptions.general
  };
};

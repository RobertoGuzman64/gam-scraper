import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { resolveMercaelevaVerifiedSourceEditorial } from "./providers/mercaeleva/verified-source-editorial.js";
import { resolveGamVerifiedUnitSourceGeneral } from "./providers/gam/editorial-descriptions/verified-unit-source-general.js";
import { resolveVerifiedCanonicalBriefEditorial } from "./verified-canonical-brief-editorial.js";
import { applyVerifiedEditorialComposition } from "./verified-editorial-composition.js";
import { resolveVerifiedUnitSummaryEditorial } from "./verified-unit-summary-editorial.js";
import { resolveGomarizVerifiedModelGeneral } from "./providers/gomariz/verified-model-general.js";
import { resolveGamVerifiedResidualGeneral } from "./providers/gam/editorial-descriptions/verified-residual-general.js";
import { includeSourceYearInGeneral } from "./source-year-general.js";
import { includeGamRegenerativeBrakingInGeneral } from "./providers/gam/editorial-descriptions/source-regenerative-braking-general.js";
import { includeGamSourceUnitDetailsInGeneral } from "./providers/gam/editorial-descriptions/source-unit-details-general.js";
import { includeGamSourceGradeabilityInGeneral } from "./providers/gam/editorial-descriptions/source-gradeability-general.js";
import { includeGamSourceDeclaredWeightInGeneral } from "./providers/gam/editorial-descriptions/source-declared-weight-general.js";
import { includeGamSourceSafetyControlsInGeneral } from "./providers/gam/editorial-descriptions/source-safety-controls-general.js";
import { includeGamSourceBatteryVoltageInGeneral } from "./providers/gam/editorial-descriptions/source-battery-voltage-general.js";
import { includeGamSourceMachineDimensionsInGeneral } from "./providers/gam/editorial-descriptions/source-machine-dimensions-general.js";
import { includeGamSourceForkliftMeasuresInGeneral } from "./providers/gam/editorial-descriptions/source-forklift-measures-general.js";

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
    ? resolveGamVerifiedResidualGeneral(sourceUnitRecord, verifiedModelGeneral ?? verifiedDescriptions.general) : null;
  const verifiedUnitSummary = allowVerifiedEnrichment
    ? resolveVerifiedUnitSummaryEditorial(sourceUnitRecord, verifiedDescriptions.short, verifiedDescriptions.general) : null;

  return {
    short: verifiedUnitSummary ?? verifiedDescriptions.short,
    general: verifiedResidualGeneral ?? verifiedModelGeneral ?? verifiedDescriptions.general
  };
};

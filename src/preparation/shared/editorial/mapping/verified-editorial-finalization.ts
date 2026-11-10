import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { resolveMercaelevaVerifiedSourceEditorial } from "../../../mercaeleva/editorial/mapping/verified-source-editorial.js";
import { resolveVerifiedCanonicalBriefEditorial } from "./verified-canonical-brief-editorial.js";
import { applyVerifiedEditorialComposition } from "./verified-editorial-composition.js";
import { resolveVerifiedUnitSummaryEditorial } from "./verified-unit-summary-editorial.js";
import { resolveGomarizVerifiedModelGeneral } from "../../../gomariz/editorial/mapping/verified-model-general.js";
import { includeSourceYearInGeneral } from "./source-year-general.js";
import { includeGamPreparedSourceDetails, resolveGamPreparedSourceMatchedGeneral } from "../../../gam/editorial/prepared-finalization.js";

export const finalizePreparedEditorial = (
  record: ProductRecord,
  sourceUnitRecord: ProductRecord,
  preparedShort: string | null,
  preparedLong: string | null,
  sourceFuelSpecs: SpecsMap,
  allowVerifiedEnrichment: boolean
) => {
  const sourceYearGeneral = allowVerifiedEnrichment ? includeSourceYearInGeneral(record, preparedLong, preparedShort, sourceFuelSpecs) : preparedLong;
  const verifiedSourceGeneral = allowVerifiedEnrichment
    ? includeGamPreparedSourceDetails(record, sourceUnitRecord, sourceYearGeneral, sourceFuelSpecs) : sourceYearGeneral;
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
    ? resolveGamPreparedSourceMatchedGeneral(sourceUnitRecord, verifiedModelGeneral ?? verifiedDescriptions.general) : null;
  const verifiedUnitSummary = allowVerifiedEnrichment
    ? resolveVerifiedUnitSummaryEditorial(sourceUnitRecord, verifiedDescriptions.short, verifiedDescriptions.general) : null;

  return {
    short: verifiedUnitSummary ?? verifiedDescriptions.short,
    general: verifiedResidualGeneral ?? verifiedModelGeneral ?? verifiedDescriptions.general
  };
};

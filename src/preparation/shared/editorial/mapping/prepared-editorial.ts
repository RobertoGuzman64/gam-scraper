import type { SourceEditorialEvidence } from "./source-editorial-evidence.js";
import { resolveGamCondensedEditorialGeneral, resolveGamCondensedEditorialShort } from "../../../gam/editorial/mapping/condensed-editorial-resolver.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { distinguishDescriptions } from "../../../../catalog/normalization/descriptions.js";
import { resolveMercaelevaShortDescription } from "../../../mercaeleva/editorial/mapping/descriptions.js";
import { resolveMercaelevaConciseDescription } from "../../../mercaeleva/editorial/mapping/concise-description.js";
import { resolveMercaelevaGeneralDescription } from "../../../mercaeleva/editorial/mapping/general-description.js";
import { resolveMercaelevaDocumentedPlatformGeneral } from "../../../mercaeleva/editorial/mapping/documented-platform-general.js";
import { resolveMercaelevaDocumentedAdditionalPlatformGeneral } from "../../../mercaeleva/editorial/mapping/documented-additional-platform-general.js";
import { resolveMercaelevaDocumentedModelDimensionsGeneral } from "../../../mercaeleva/editorial/mapping/documented-model-dimensions-general.js";
import { resolveMercaelevaDocumentedFurtherPlatformGeneral } from "../../../mercaeleva/editorial/mapping/documented-further-platform-general.js";
import { resolveMercaelevaDocumentedModelOperatingGeneral } from "../../../mercaeleva/editorial/mapping/documented-model-operating-general.js";
import { resolveMercaelevaPreviousGenerationPlatformGeneral } from "../../../mercaeleva/editorial/mapping/documented-previous-generation-platform-general.js";
import { resolveGomarizVerifiedUnitSpecificTitle } from "../../../gomariz/editorial/mapping/verified-unit-specific-title.js";
import { resolveGamVerifiedSourceMatchedTitle } from "../../../gam/editorial/mapping/verified-source-matched-title.js";
import { verifiedMercaelevaCriticalGeneral } from "../../../mercaeleva/editorial/evidence/critical-general-descriptions.js";
import { verifiedPriorityPlatformGeneral } from "../../../mercaeleva/editorial/evidence/priority-platform-generals.js";
import { verifiedMercaelevaUnitSpecificGeneral } from "../../../mercaeleva/editorial/evidence/verified-unit-specific-generals.js";
import { verifiedMercaelevaUnitGeneral } from "../../../mercaeleva/editorial/mapping/verified-unit-general.js";
import { mercaelevaMissingDescriptions } from "../../../mercaeleva/editorial/mapping/missing-descriptions.js";
import { gamMissingDescriptions } from "../../../gam/editorial/mapping/missing-descriptions.js";
import { rebalanceGamOverlongShort, resolveGamResidualConciseShort } from "../../../gam/editorial/mapping/short-description.js";
import { resolveGamConciseTitle } from "../../../gam/editorial/mapping/concise-titles.js";
import { rebalanceGamTechnicalShort } from "../../../gam/editorial/mapping/rebalance-technical-short.js";
import { resolveGomarizEditorialTitle } from "../../../gomariz/editorial/mapping/editorial-title.js";
import { resolveMercaelevaEditorialTitle } from "../../../mercaeleva/editorial/mapping/editorial-title.js";
import { resolveGamGeneralDescription } from "../../../gam/editorial/mapping/general-description.js";
import { resolveGamVerifiedCommercialShort } from "../../../gam/editorial/mapping/verified-commercial-short.js";
import { resolveGamVerifiedConciseGeneral } from "../../../gam/editorial/mapping/verified-concise-long.js";
import { resolveGamVerifiedElevationGeneral } from "../../../gam/editorial/mapping/verified-elevation-general.js";
import { resolveGamSpecialtyEditorial } from "../../../gam/editorial/mapping/specialty-editorial.js";
import { resolveGamWarehouseTechnicalEditorial } from "../../../gam/editorial/mapping/warehouse-technical-editorial.js";
import { resolveGamHandlingSourceEditorial } from "../../../gam/editorial/mapping/handling-source-editorial.js";
import { resolveGamVerifiedSourceMatchedEditorial } from "../../../gam/editorial/mapping/verified-source-matched-editorial.js";
import { resolveGamVerifiedExtendedGeneral } from "../../../gam/editorial/mapping/verified-extended-general.js";
import { resolveGamVerifiedIndustrialCleaningGeneral, resolveGamVerifiedIndustrialCleaningShort } from "../../../gam/editorial/mapping/verified-industrial-cleaning-editorial.js";
import { resolveGamModelSpecificGeneral } from "../../../gam/editorial/mapping/model-specific-general.js";
import { removeGamDetachedAffirmatives, removeGamOrphanAffirmative, removeGamResidualEditorialArtifacts, resolveGamLongDescription } from "../../../gam/editorial/mapping/long-description.js";
import { resolveGamVerifiedBriefGeneral } from "../../../gam/editorial/mapping/brief-technical-general.js";
import { resolveGamPriorityBriefGeneral } from "../../../gam/editorial/mapping/priority-brief-general.js";
import { resolveGamCriticalBriefGeneral } from "../../../gam/editorial/mapping/critical-brief-general.js";
import { resolveGamTecnacarGeneral } from "../../../gam/editorial/mapping/tecnacar-general.js";
import { resolveGamIndividualizedGeneral } from "../../../gam/editorial/mapping/individualized-general.js";
import { resolveGamUsedYearGeneral } from "../../../gam/editorial/mapping/used-year-general.js";
import { resolveGamUsedHoursGeneral } from "../../../gam/editorial/mapping/used-hours-general.js";
import { resolveGamUsedUnitGeneral } from "../../../gam/editorial/mapping/used-unit-general.js";
import { resolveGamYaleDieselDimensions } from "../../../gam/technical/mapping/yale-diesel-dimensions.js";
import { resolveGamExactVariantGeneral, resolveGamModelIdentifiedGeneral, resolveGamSourceIdentifiedModel } from "../../../gam/editorial/mapping/model-identified-general.js";
import { verifiedGomarizPriorityGeneral } from "../../../gomariz/editorial/evidence/verified-priority-general.js";
import { resolveGomarizIndividualizedGeneral } from "../../../gomariz/editorial/mapping/individualized-general.js";
import { resolveGomarizShortDescription } from "../../../gomariz/editorial/mapping/short-description.js";
import { resolveGomarizCriticalBriefGeneral } from "../../../gomariz/editorial/mapping/critical-brief-general.js";
import { resolveGomarizGeneralDescription } from "../../../gomariz/editorial/mapping/general-description.js";
import { removeGomarizConversationalLead, resolveGomarizUnitSpecificGeneral } from "../../../gomariz/editorial/mapping/unit-specific-general.js";
import { gamElevationSourceIdentityConflict } from "../../../gam/identity/evidence/elevation-identity.js";
import { refineTechnicalTitle } from "./technical-title-refinement.js";

export const resolvePreparedEditorial = (
  record: ProductRecord,
  sourceUnitRecord: ProductRecord,
  sourceEditorial: SourceEditorialEvidence
) => {
  const { crossedIdentity, verifiedGamCondensedGeneral, conciseGamShort, verifiedGamFamilyGeneral } = sourceEditorial;
  const mappedTitle = (resolveGomarizEditorialTitle(record) ?? resolveGamConciseTitle(record) ?? resolveMercaelevaEditorialTitle(record) ?? record.title?.trim()) || null;
  const title = refineTechnicalTitle(sourceUnitRecord, resolveGomarizVerifiedUnitSpecificTitle(sourceUnitRecord, mappedTitle) ?? resolveGamVerifiedSourceMatchedTitle(sourceUnitRecord, mappedTitle) ?? mappedTitle);
  const descriptionEvidence = resolveMercaelevaShortDescription(record);
  const conciseMercaelevaShort = resolveMercaelevaConciseDescription(record);
  const missingDescriptions = mercaelevaMissingDescriptions(record);
  const missingGamDescriptions = gamMissingDescriptions(record);
  const existingMercaelevaGeneral = resolveMercaelevaDocumentedModelOperatingGeneral(record) ?? resolveMercaelevaDocumentedFurtherPlatformGeneral(record) ?? verifiedMercaelevaCriticalGeneral(record) ?? verifiedPriorityPlatformGeneral(record) ?? verifiedMercaelevaUnitSpecificGeneral(record) ?? verifiedMercaelevaUnitGeneral(record) ?? resolveMercaelevaDocumentedPlatformGeneral(record) ?? resolveMercaelevaDocumentedAdditionalPlatformGeneral(record) ?? resolveMercaelevaDocumentedModelDimensionsGeneral(record) ?? resolveMercaelevaGeneralDescription(record);
  const mercaelevaGeneral = existingMercaelevaGeneral && existingMercaelevaGeneral.trim().split(/\s+/u).length >= 60
    ? existingMercaelevaGeneral
    : resolveMercaelevaPreviousGenerationPlatformGeneral(record) ?? existingMercaelevaGeneral;
  const general = crossedIdentity?.general ?? verifiedGamCondensedGeneral ?? resolveGamCondensedEditorialGeneral(record) ?? resolveGamIndividualizedGeneral(record) ?? verifiedGomarizPriorityGeneral(record) ?? resolveGomarizIndividualizedGeneral(record) ?? resolveGomarizCriticalBriefGeneral(record) ?? resolveGomarizGeneralDescription(record) ?? resolveGomarizUnitSpecificGeneral(record) ?? mercaelevaGeneral ?? resolveGamPriorityBriefGeneral(record) ?? resolveGamCriticalBriefGeneral(record) ?? resolveGamGeneralDescription(record) ?? resolveGamModelSpecificGeneral(record) ?? resolveGamLongDescription(record) ?? verifiedGamFamilyGeneral ?? resolveGamTecnacarGeneral(record) ?? record.longDescription ?? missingDescriptions.long ?? missingGamDescriptions.long;
  const balanced = conciseGamShort === null ? rebalanceGamOverlongShort(record, general) : null;
  const technicalBalance = conciseGamShort === null && balanced === null ? rebalanceGamTechnicalShort(record, general) : null;
  const conciseResidual = conciseGamShort === null && balanced === null && technicalBalance === null ? resolveGamResidualConciseShort(record, general) : null;
  const descriptions = distinguishDescriptions(
    crossedIdentity?.short ?? resolveGamVerifiedCommercialShort(record) ?? resolveGamCondensedEditorialShort(record) ?? conciseGamShort ?? balanced?.short ?? technicalBalance?.short ?? conciseResidual ?? conciseMercaelevaShort ?? record.shortDescription ?? descriptionEvidence.description ?? resolveGomarizShortDescription(record) ?? missingGamDescriptions.short,
    balanced?.general ?? technicalBalance?.general ?? general
  );
  const residualCleaningShort = resolveGamVerifiedIndustrialCleaningShort(record, descriptions.short);
  const usedYearGeneral = resolveGamUsedYearGeneral(record, descriptions.short, descriptions.long);
  const usedHoursGeneral = resolveGamUsedHoursGeneral(record, usedYearGeneral ?? descriptions.long);
  const usedUnitGeneral = resolveGamUsedUnitGeneral(record, usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const yaleDieselDimensions = resolveGamYaleDieselDimensions(record, usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const modelIdentifiedGeneral = resolveGamModelIdentifiedGeneral(record, yaleDieselDimensions ?? usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const exactVariantGeneral = resolveGamExactVariantGeneral(record, modelIdentifiedGeneral ?? yaleDieselDimensions ?? usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const briefTechnicalGeneral = resolveGamVerifiedBriefGeneral(record, exactVariantGeneral ?? modelIdentifiedGeneral ?? yaleDieselDimensions ?? usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const sourceIdentifiedGeneral = resolveGamSourceIdentifiedModel(record, briefTechnicalGeneral ?? exactVariantGeneral ?? modelIdentifiedGeneral ?? yaleDieselDimensions ?? usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const preparedGeneral = sourceIdentifiedGeneral ?? briefTechnicalGeneral ?? exactVariantGeneral ?? modelIdentifiedGeneral ?? yaleDieselDimensions ?? usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long;
  const baseEditorialGeneral = removeGamOrphanAffirmative(record, preparedGeneral) ?? removeGamDetachedAffirmatives(record, preparedGeneral) ?? preparedGeneral;
  const editorialGeneral = removeGamResidualEditorialArtifacts(record, baseEditorialGeneral) ?? removeGomarizConversationalLead(record, baseEditorialGeneral) ?? baseEditorialGeneral;
  const conciseVerifiedGeneral = resolveGamVerifiedConciseGeneral(record, editorialGeneral);
  const elevationGeneral = resolveGamVerifiedElevationGeneral(record, conciseVerifiedGeneral ?? editorialGeneral);
  const residualCleaningGeneral = resolveGamVerifiedIndustrialCleaningGeneral(record, elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral);
  const specialtyEditorial = resolveGamSpecialtyEditorial(
    record, residualCleaningShort ?? descriptions.short,
    residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral
  );
  const warehouseEditorial = resolveGamWarehouseTechnicalEditorial(
    record, specialtyEditorial?.short ?? residualCleaningShort ?? descriptions.short,
    specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral
  );
  const handlingEditorial = resolveGamHandlingSourceEditorial(
    record, warehouseEditorial?.short ?? specialtyEditorial?.short ?? residualCleaningShort ?? descriptions.short,
    warehouseEditorial?.general ?? specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral
  );
  const verifiedResidualEditorial = resolveGamVerifiedSourceMatchedEditorial(
    record, handlingEditorial?.short ?? warehouseEditorial?.short ?? specialtyEditorial?.short ?? residualCleaningShort ?? descriptions.short,
    handlingEditorial?.general ?? warehouseEditorial?.general ?? specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral
  );
  const extendedGeneral = resolveGamVerifiedExtendedGeneral(record, verifiedResidualEditorial?.general ?? handlingEditorial?.general ?? warehouseEditorial?.general ?? specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral);
  const preparedShort = verifiedResidualEditorial?.short ?? handlingEditorial?.short ?? warehouseEditorial?.short ?? specialtyEditorial?.short ?? residualCleaningShort ?? descriptions.short;
  const preparedLong = extendedGeneral ?? verifiedResidualEditorial?.general ?? handlingEditorial?.general ?? warehouseEditorial?.general ?? specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral;
  return {
    title,
    preparedShort,
    preparedLong,
    heightConflict: descriptionEvidence.heightConflict,
    sourceIdentityConflict: gamElevationSourceIdentityConflict(record)
  };
};

export type ResolvedPreparedEditorial = ReturnType<typeof resolvePreparedEditorial>;

import type { SourceEditorialEvidence } from "./source-editorial-evidence.js";
import { resolveGamCondensedEditorialGeneral, resolveGamCondensedEditorialShort } from "./providers/gam/editorial-descriptions/condensed-editorial-resolver.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { distinguishDescriptions } from "../../normalization/descriptions.js";
import { resolveMercaelevaShortDescription } from "./providers/mercaeleva/descriptions.js";
import { resolveMercaelevaConciseDescription } from "./providers/mercaeleva/concise-description.js";
import { resolveMercaelevaGeneralDescription } from "./providers/mercaeleva/general-description.js";
import { resolveMercaelevaDocumentedPlatformGeneral } from "./providers/mercaeleva/documented-platform-general.js";
import { resolveMercaelevaDocumentedAdditionalPlatformGeneral } from "./providers/mercaeleva/documented-additional-platform-general.js";
import { resolveMercaelevaDocumentedModelDimensionsGeneral } from "./providers/mercaeleva/documented-model-dimensions-general.js";
import { resolveMercaelevaDocumentedFurtherPlatformGeneral } from "./providers/mercaeleva/documented-further-platform-general.js";
import { resolveMercaelevaDocumentedModelOperatingGeneral } from "./providers/mercaeleva/documented-model-operating-general.js";
import { resolveMercaelevaPreviousGenerationPlatformGeneral } from "./providers/mercaeleva/documented-previous-generation-platform-general.js";
import { resolveGomarizVerifiedUnitSpecificTitle } from "./providers/gomariz/verified-unit-specific-title.js";
import { resolveGamVerifiedSourceMatchedTitle } from "./providers/gam/editorial-descriptions/verified-source-matched-title.js";
import { verifiedMercaelevaCriticalGeneral } from "../evidence/providers/mercaeleva/critical-general-descriptions.js";
import { verifiedPriorityPlatformGeneral } from "../evidence/providers/mercaeleva/priority-platform-generals.js";
import { verifiedMercaelevaUnitSpecificGeneral } from "../evidence/providers/mercaeleva/verified-unit-specific-generals.js";
import { verifiedMercaelevaUnitGeneral } from "./providers/mercaeleva/verified-unit-general.js";
import { mercaelevaMissingDescriptions } from "./providers/mercaeleva/missing-descriptions.js";
import { gamMissingDescriptions } from "./providers/gam/editorial-descriptions/missing-descriptions.js";
import { rebalanceGamOverlongShort, resolveGamResidualConciseShort } from "./providers/gam/editorial-descriptions/short-description.js";
import { resolveGamConciseTitle } from "./providers/gam/editorial-descriptions/concise-titles.js";
import { rebalanceGamTechnicalShort } from "./providers/gam/editorial-descriptions/rebalance-technical-short.js";
import { resolveGomarizEditorialTitle } from "./providers/gomariz/editorial-title.js";
import { resolveGamGeneralDescription } from "./providers/gam/editorial-descriptions/general-description.js";
import { resolveGamVerifiedCommercialShort } from "./providers/gam/editorial-descriptions/verified-commercial-short.js";
import { resolveGamVerifiedConciseGeneral } from "./providers/gam/editorial-descriptions/verified-concise-long.js";
import { resolveGamVerifiedElevationGeneral } from "./providers/gam/editorial-descriptions/verified-elevation-general.js";
import { resolveGamSpecialtyEditorial } from "./providers/gam/editorial-descriptions/specialty-editorial.js";
import { resolveGamWarehouseTechnicalEditorial } from "./providers/gam/editorial-descriptions/warehouse-technical-editorial.js";
import { resolveGamHandlingSourceEditorial } from "./providers/gam/editorial-descriptions/handling-source-editorial.js";
import { resolveGamVerifiedSourceMatchedEditorial } from "./providers/gam/editorial-descriptions/verified-source-matched-editorial.js";
import { resolveGamVerifiedExtendedGeneral } from "./providers/gam/editorial-descriptions/verified-extended-general.js";
import { resolveGamVerifiedIndustrialCleaningGeneral, resolveGamVerifiedIndustrialCleaningShort } from "./providers/gam/editorial-descriptions/verified-industrial-cleaning-editorial.js";
import { resolveGamModelSpecificGeneral } from "./providers/gam/editorial-descriptions/model-specific-general.js";
import { removeGamDetachedAffirmatives, removeGamOrphanAffirmative, removeGamResidualEditorialArtifacts, resolveGamLongDescription } from "./providers/gam/editorial-descriptions/long-description.js";
import { resolveGamVerifiedBriefGeneral } from "./providers/gam/editorial-descriptions/brief-technical-general.js";
import { resolveGamPriorityBriefGeneral } from "./providers/gam/editorial-descriptions/priority-brief-general.js";
import { resolveGamCriticalBriefGeneral } from "./providers/gam/editorial-descriptions/critical-brief-general.js";
import { resolveGamTecnacarGeneral } from "./providers/gam/editorial-descriptions/tecnacar-general.js";
import { resolveGamIndividualizedGeneral } from "./providers/gam/editorial-descriptions/individualized-general.js";
import { resolveGamUsedYearGeneral } from "./providers/gam/editorial-descriptions/used-year-general.js";
import { resolveGamUsedHoursGeneral } from "./providers/gam/editorial-descriptions/used-hours-general.js";
import { resolveGamUsedUnitGeneral } from "./providers/gam/editorial-descriptions/used-unit-general.js";
import { resolveGamYaleDieselDimensions } from "./providers/gam/technical-rules/yale-diesel-dimensions.js";
import { resolveGamExactVariantGeneral, resolveGamModelIdentifiedGeneral, resolveGamSourceIdentifiedModel } from "./providers/gam/editorial-descriptions/model-identified-general.js";
import { verifiedGomarizPriorityGeneral } from "../evidence/providers/gomariz/verified-priority-general.js";
import { resolveGomarizIndividualizedGeneral } from "./providers/gomariz/individualized-general.js";
import { resolveGomarizShortDescription } from "./providers/gomariz/short-description.js";
import { resolveGomarizCriticalBriefGeneral } from "./providers/gomariz/critical-brief-general.js";
import { resolveGomarizGeneralDescription } from "./providers/gomariz/general-description.js";
import { removeGomarizConversationalLead, resolveGomarizUnitSpecificGeneral } from "./providers/gomariz/unit-specific-general.js";
import { gamElevationSourceIdentityConflict } from "../evidence/providers/gam/identity/elevation-identity.js";

export const resolvePreparedEditorial = (
  record: ProductRecord,
  sourceUnitRecord: ProductRecord,
  sourceEditorial: SourceEditorialEvidence
) => {
  const { crossedIdentity, verifiedGamCondensedGeneral, conciseGamShort, verifiedGamFamilyGeneral } = sourceEditorial;
  const mappedTitle = (resolveGomarizEditorialTitle(record) ?? resolveGamConciseTitle(record) ?? record.title?.trim()) || null;
  const title = resolveGomarizVerifiedUnitSpecificTitle(sourceUnitRecord, mappedTitle) ?? resolveGamVerifiedSourceMatchedTitle(sourceUnitRecord, mappedTitle) ?? mappedTitle;
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

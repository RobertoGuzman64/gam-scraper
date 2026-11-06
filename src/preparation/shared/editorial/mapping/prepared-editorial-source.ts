import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { SourceEditorialEvidence } from "./source-editorial-evidence.js";
import { resolveGamCondensedEditorialGeneral, resolveGamCondensedEditorialShort } from "../../../gam/editorial/condensed-editorial-resolver.js";
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
import { verifiedMercaelevaCriticalGeneral } from "../../../mercaeleva/editorial/evidence/critical-general-descriptions.js";
import { verifiedPriorityPlatformGeneral } from "../../../mercaeleva/editorial/evidence/priority-platform-generals.js";
import { verifiedMercaelevaUnitSpecificGeneral } from "../../../mercaeleva/editorial/evidence/verified-unit-specific-generals.js";
import { verifiedMercaelevaUnitGeneral } from "../../../mercaeleva/editorial/mapping/verified-unit-general.js";
import { mercaelevaMissingDescriptions } from "../../../mercaeleva/editorial/mapping/missing-descriptions.js";
import { gamMissingDescriptions } from "../../../gam/editorial/general/missing-descriptions.js";
import { rebalanceGamOverlongShort, resolveGamResidualConciseShort } from "../../../gam/editorial/short/short-description.js";
import { rebalanceGamTechnicalShort } from "../../../gam/editorial/short/rebalance-technical-short.js";
import { resolveGamGeneralDescription } from "../../../gam/editorial/general/general-description.js";
import { resolveGamVerifiedCommercialShort } from "../../../gam/editorial/short/verified-commercial-short.js";
import { resolveGamModelSpecificGeneral } from "../../../gam/editorial/general/model-specific-general.js";
import { resolveGamLongDescription } from "../../../gam/editorial/general/long-description.js";
import { resolveGamPriorityBriefGeneral } from "../../../gam/editorial/general/priority-brief-general.js";
import { resolveGamCriticalBriefGeneral } from "../../../gam/editorial/general/critical-brief-general.js";
import { resolveGamTecnacarGeneral } from "../../../gam/editorial/general/tecnacar-general.js";
import { resolveGamIndividualizedGeneral } from "../../../gam/editorial/general/individualized-general.js";
import { verifiedGomarizPriorityGeneral } from "../../../gomariz/editorial/evidence/verified-priority-general.js";
import { resolveGomarizIndividualizedGeneral } from "../../../gomariz/editorial/mapping/individualized-general.js";
import { resolveGomarizShortDescription } from "../../../gomariz/editorial/mapping/short-description.js";
import { resolveGomarizCriticalBriefGeneral } from "../../../gomariz/editorial/mapping/critical-brief-general.js";
import { resolveGomarizGeneralDescription } from "../../../gomariz/editorial/mapping/general-description.js";
import { resolveGomarizUnitSpecificGeneral } from "../../../gomariz/editorial/mapping/unit-specific-general.js";

export const resolvePreparedEditorialSource = (record: ProductRecord, sourceEditorial: SourceEditorialEvidence) => {
  const { crossedIdentity, verifiedGamCondensedGeneral, conciseGamShort, verifiedGamFamilyGeneral } = sourceEditorial;
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
  return { descriptions, heightConflict: descriptionEvidence.heightConflict };
};

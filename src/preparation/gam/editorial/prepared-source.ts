import type { ProductRecord } from "../../../contracts/catalog.js";
import { resolveGamCondensedEditorialGeneral, resolveGamCondensedEditorialShort } from "./condensed-editorial-resolver.js";
import { gamMissingDescriptions } from "./general/missing-descriptions.js";
import { rebalanceGamOverlongShort, resolveGamResidualConciseShort } from "./short/short-description.js";
import { rebalanceGamTechnicalShort } from "./short/rebalance-technical-short.js";
import { resolveGamGeneralDescription } from "./general/general-description.js";
import { resolveGamVerifiedCommercialShort } from "./short/verified-commercial-short.js";
import { resolveGamModelSpecificGeneral } from "./general/model-specific-general.js";
import { resolveGamLongDescription } from "./general/long-description.js";
import { resolveGamPriorityBriefGeneral } from "./general/priority-brief-general.js";
import { resolveGamCriticalBriefGeneral } from "./general/critical-brief-general.js";
import { resolveGamTecnacarGeneral } from "./general/tecnacar-general.js";
import { resolveGamIndividualizedGeneral } from "./general/individualized-general.js";

export const resolveGamPreparedMissingDescriptions = gamMissingDescriptions;

export const resolveGamPreparedPriorityGeneral = (record: ProductRecord) =>
  resolveGamCondensedEditorialGeneral(record) ?? resolveGamIndividualizedGeneral(record);

export const resolveGamPreparedFallbackGeneral = (record: ProductRecord, verifiedFamilyGeneral: string | null) =>
  resolveGamPriorityBriefGeneral(record) ?? resolveGamCriticalBriefGeneral(record) ?? resolveGamGeneralDescription(record) ?? resolveGamModelSpecificGeneral(record) ?? resolveGamLongDescription(record) ?? verifiedFamilyGeneral ?? resolveGamTecnacarGeneral(record);

export const resolveGamPreparedSourceShort = (record: ProductRecord) =>
  resolveGamVerifiedCommercialShort(record) ?? resolveGamCondensedEditorialShort(record);

export const resolveGamPreparedShortBalance = (record: ProductRecord, general: string | null, conciseGamShort: string | null) => {
  const balanced = conciseGamShort === null ? rebalanceGamOverlongShort(record, general) : null;
  const technicalBalance = conciseGamShort === null && balanced === null ? rebalanceGamTechnicalShort(record, general) : null;
  const conciseResidual = conciseGamShort === null && balanced === null && technicalBalance === null ? resolveGamResidualConciseShort(record, general) : null;
  return { balanced, technicalBalance, conciseResidual };
};

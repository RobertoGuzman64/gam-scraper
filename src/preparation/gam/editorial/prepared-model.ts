import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ProductDescriptions } from "../../../catalog/normalization/descriptions.js";
import { resolveGamVerifiedIndustrialCleaningShort } from "./general/verified-industrial-cleaning-editorial.js";
import { removeGamDetachedAffirmatives, removeGamOrphanAffirmative, removeGamResidualEditorialArtifacts } from "./general/long-description.js";
import { resolveGamVerifiedBriefGeneral } from "./general/brief-technical-general.js";
import { resolveGamUsedYearGeneral } from "./source/used-year-general.js";
import { resolveGamUsedHoursGeneral } from "./source/used-hours-general.js";
import { resolveGamUsedUnitGeneral } from "./source/used-unit-general.js";
import { resolveGamYaleDieselDimensions } from "../technical/models/yale-diesel-dimensions.js";
import { resolveGamExactVariantGeneral, resolveGamModelIdentifiedGeneral, resolveGamSourceIdentifiedModel } from "./general/model-identified-general.js";

export const resolveGamPreparedModel = (record: ProductRecord, descriptions: ProductDescriptions) => {
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
  const residualEditorialGeneral = removeGamResidualEditorialArtifacts(record, baseEditorialGeneral);
  return { residualCleaningShort, baseEditorialGeneral, residualEditorialGeneral };
};

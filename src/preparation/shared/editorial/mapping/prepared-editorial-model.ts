import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { ProductDescriptions } from "../../../../catalog/normalization/descriptions.js";
import { resolveGamVerifiedIndustrialCleaningShort } from "../../../gam/editorial/general/verified-industrial-cleaning-editorial.js";
import { removeGamDetachedAffirmatives, removeGamOrphanAffirmative, removeGamResidualEditorialArtifacts } from "../../../gam/editorial/general/long-description.js";
import { resolveGamVerifiedBriefGeneral } from "../../../gam/editorial/general/brief-technical-general.js";
import { resolveGamUsedYearGeneral } from "../../../gam/editorial/source/used-year-general.js";
import { resolveGamUsedHoursGeneral } from "../../../gam/editorial/source/used-hours-general.js";
import { resolveGamUsedUnitGeneral } from "../../../gam/editorial/source/used-unit-general.js";
import { resolveGamYaleDieselDimensions } from "../../../gam/technical/models/yale-diesel-dimensions.js";
import { resolveGamExactVariantGeneral, resolveGamModelIdentifiedGeneral, resolveGamSourceIdentifiedModel } from "../../../gam/editorial/general/model-identified-general.js";
import { removeGomarizConversationalLead } from "../../../gomariz/editorial/mapping/unit-specific-general.js";

export const resolvePreparedEditorialModel = (record: ProductRecord, descriptions: ProductDescriptions) => {
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
  return { residualCleaningShort, editorialGeneral };
};

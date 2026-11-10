import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { ProductDescriptions } from "../../../../catalog/normalization/descriptions.js";
import { resolveGamPreparedModel } from "../../../gam/editorial/prepared-model.js";
import { removeGomarizConversationalLead } from "../../../gomariz/editorial/mapping/unit-specific-general.js";

export const resolvePreparedEditorialModel = (record: ProductRecord, descriptions: ProductDescriptions) => {
  const { residualCleaningShort, baseEditorialGeneral, residualEditorialGeneral } = resolveGamPreparedModel(record, descriptions);
  const editorialGeneral = residualEditorialGeneral ?? removeGomarizConversationalLead(record, baseEditorialGeneral) ?? baseEditorialGeneral;
  return { residualCleaningShort, editorialGeneral };
};

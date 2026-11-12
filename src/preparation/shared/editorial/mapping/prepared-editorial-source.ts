import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { SourceEditorialEvidence } from "./source-editorial-evidence.js";
import { distinguishDescriptions } from "../../../../catalog/normalization/descriptions.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveGamPreparedMissingDescriptions, resolveGamPreparedPriorityGeneral, resolveGamPreparedFallbackGeneral, resolveGamPreparedSourceShort, resolveGamPreparedShortBalance } from "../../../gam/editorial/prepared-source.js";
import { resolveMercaelevaPreparedSourceShort, resolveMercaelevaPreparedSourceGeneral } from "../../../mercaeleva/editorial/mapping/prepared-source.js";
import { resolveGomarizPreparedSourceGeneral, resolveGomarizPreparedSourceShort } from "../../../gomariz/editorial/mapping/prepared-source.js";

export const resolvePreparedEditorialSource = (record: ProductRecord, sourceEditorial: SourceEditorialEvidence) => {
  const { crossedIdentity, verifiedGamCondensedGeneral, conciseGamShort, verifiedGamFamilyGeneral } = sourceEditorial;
  const { descriptionEvidence, conciseShort: conciseMercaelevaShort, missingDescriptions } = resolveMercaelevaPreparedSourceShort(record);
  const missingGamDescriptions = resolveGamPreparedMissingDescriptions(record);
  const reusableEditorial = resolveReusableEditorial(record);
  const mercaelevaGeneral = resolveMercaelevaPreparedSourceGeneral(record);
  const general = crossedIdentity?.general ?? verifiedGamCondensedGeneral ?? resolveGamPreparedPriorityGeneral(record) ?? resolveGomarizPreparedSourceGeneral(record) ?? mercaelevaGeneral ?? resolveGamPreparedFallbackGeneral(record, verifiedGamFamilyGeneral) ?? record.longDescription ?? missingDescriptions.long ?? missingGamDescriptions.long ?? reusableEditorial.general;
  const { balanced, technicalBalance, conciseResidual } = resolveGamPreparedShortBalance(record, general, conciseGamShort);
  const descriptions = distinguishDescriptions(
    crossedIdentity?.short ?? resolveGamPreparedSourceShort(record) ?? conciseGamShort ?? balanced?.short ?? technicalBalance?.short ?? conciseResidual ?? conciseMercaelevaShort ?? record.shortDescription ?? descriptionEvidence.description ?? resolveGomarizPreparedSourceShort(record) ?? missingGamDescriptions.short ?? reusableEditorial.short,
    balanced?.general ?? technicalBalance?.general ?? general
  );
  return { descriptions, heightConflict: descriptionEvidence.heightConflict };
};

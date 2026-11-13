import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { SourceEditorialEvidence } from "./source-editorial-evidence.js";
import { distinguishDescriptions } from "../../../../catalog/normalization/descriptions.js";
import { hasEditorialSourceWorkHeightConflict } from "../domain/editorial-height-consistency.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { resolveUnbrandedEditorial } from "../domain/editorial-unbranded-equipment.js";
import { resolveVerifiedEditorialUnitContext } from "../domain/editorial-unit-context.js";
import { cleanAuthenticatedSourceEditorial } from "../domain/editorial-text-hygiene.js";
import { resolveKnowledgeEditorial } from "./knowledge-editorial.js";
import { conciseVerifiedUnitGeneral, conciseSignedUnitGeneral, resolveEditorialIdentitySummary } from "../domain/editorial-identity-summary.js";
import { compressVerifiedSourceShort } from "../domain/editorial-source-brief.js";
import { editorialFamilyFromSourceGeneral } from "../domain/editorial-families.js";
import { resolveVerifiedTechnicalBrief } from "../domain/editorial-technical-brief.js";
import { resolveVerifiedSourceEditorialExcerpt } from "../domain/editorial-source-excerpt.js";
import { resolveMissingTechnicalEditorialGeneral } from "../domain/editorial-missing-technical-general.js";

export const resolvePreparedEditorialSource = (
  record: ProductRecord,
  evidence: SourceEditorialEvidence,
  sourceUnitRecord: ProductRecord = record
) => {
  const heightConflict = hasEditorialSourceWorkHeightConflict(record);
  const verified = evidence.sourceVerified && evidence.identityVerified && !heightConflict;
  const resolvedKnowledge = resolveKnowledgeEditorial(record, sourceUnitRecord);
  const knowledge = verified || resolvedKnowledge.identityOverride ||
    Boolean(resolvedKnowledge.short || resolvedKnowledge.general || resolvedKnowledge.fallbackGeneral ||
      resolvedKnowledge.title) ? resolvedKnowledge : null;
  const sourceFamily = verified && !sourceUnitRecord.shortDescription?.trim() ?
    editorialFamilyFromSourceGeneral(sourceUnitRecord.longDescription) : null;
  const familyOverride = knowledge?.familyOverride ?? sourceFamily;
  const composed = verified ? resolveUnbrandedEditorial(record) ?? resolveReusableEditorial(record, familyOverride, sourceUnitRecord) : { short: null, general: null };
  const general = knowledge?.general ??
    (verified ? resolveSourceEditorialClaims(sourceUnitRecord, record, composed.general) : null) ??
    knowledge?.fallbackGeneral ??
    (verified ? resolveMissingTechnicalEditorialGeneral(sourceUnitRecord, record) : null) ?? null;
  const signedGeneral = Boolean(general &&
    (general === knowledge?.general || general === knowledge?.fallbackGeneral));
  const recoveredShort = !record.shortDescription?.trim() ?
    (signedGeneral && general ? conciseVerifiedUnitGeneral(sourceUnitRecord, general) ??
      conciseSignedUnitGeneral(general) : null) ??
      (verified ? resolveVerifiedSourceEditorialExcerpt(sourceUnitRecord) : null) ??
      resolveEditorialIdentitySummary(record, familyOverride) ??
      (verified ? resolveVerifiedTechnicalBrief(sourceUnitRecord, record) : null) : null;
  const narrative = general && !signedGeneral ? [knowledge?.familyGuidance, knowledge?.modelReference]
    .filter((part): part is string => Boolean(part)).join(" ") : "";
  const assembledGeneral = general ? `${general}${narrative ? ` ${narrative}` : ""}` : record.longDescription;
  const long = signedGeneral ? assembledGeneral : resolveVerifiedEditorialUnitContext(sourceUnitRecord, assembledGeneral, record);
  const sourceClean = cleanAuthenticatedSourceEditorial(sourceUnitRecord,
    knowledge?.short ?? composed.short ?? record.shortDescription ?? recoveredShort, long);
  const compact = verified && !knowledge?.short && !composed.short ?
    compressVerifiedSourceShort(sourceUnitRecord, sourceClean.short, sourceClean.general) : null;
  return {
    verifiedTitle: knowledge?.title ?? null,
    descriptions: distinguishDescriptions(compact ?? sourceClean.short, sourceClean.general),
    heightConflict
  };
};

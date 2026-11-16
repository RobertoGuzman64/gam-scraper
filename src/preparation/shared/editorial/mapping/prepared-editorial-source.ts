import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { SourceEditorialEvidence } from "./source-editorial-evidence.js";
import { verifiedMercaelevaMbCapacityProposal } from "../../../../catalog/interventions/verified-mercaeleva-capacity.js";
import { distinguishDescriptions } from "../../../../catalog/normalization/descriptions.js";
import { hasEditorialSourceWorkHeightConflict } from "../domain/editorial-height-consistency.js";
import { hasCorroboratedEditorialDistinctWorkHeights } from "../domain/editorial-source.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { hasEditorialMillimetreUnit } from "../domain/editorial-measurements.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { resolveUnbrandedEditorial } from "../domain/editorial-unbranded-equipment.js";
import { resolveVerifiedEditorialUnitContext } from "../domain/editorial-unit-context.js";
import { cleanAuthenticatedSourceEditorial } from "../domain/editorial-text-hygiene.js";
import { resolveKnowledgeEditorial } from "./knowledge-editorial.js";
import { conciseVerifiedUnitGeneral, conciseSignedUnitGeneral, resolveEditorialIdentitySummary, unresolvedEditorialModelVariantShort, unresolvedEditorialModelVariantGeneral } from "../domain/editorial-identity-summary.js";
import { compressVerifiedSourceShort } from "../domain/editorial-source-brief.js";
import { corroboratedSourceUnitBrief } from "../domain/editorial-source-unit-brief.js";
import { editorialFamilyFromSourceGeneral } from "../domain/editorial-families.js";
import { resolveVerifiedTechnicalBrief } from "../domain/editorial-technical-brief.js";
import { resolveVerifiedSourceEditorialExcerpt } from "../domain/editorial-source-excerpt.js";
import { resolveMissingTechnicalEditorialGeneral } from "../domain/editorial-missing-technical-general.js";
import { resolveDocumentedAccessoryEditorial } from "./documented-accessory.js";
import { withoutContradictoryFamilyGeneral } from "../domain/editorial-source-family-general.js";
import { resolveDocumentedModelDimensions } from "../domain/editorial-model-dimensions.js";
import { hasUncorroboratedSignedMotor, withoutUncorroboratedMotorClaim } from "../domain/editorial-signed-motor-caution.js";
import { hasCrossedGamEditorialIdentity, hasGamCorroboratedModelVariantConflict, hasGamModelTitleDisagreement } from "../../../gam/identity/evidence/gam-crossed-editorial-identity.js";
import { isGamDocumentedYaleDimensionsSource } from "../../../gam/identity/evidence/model-dimensions-source.js";

export const resolvePreparedEditorialSource = (
  record: ProductRecord,
  evidence: SourceEditorialEvidence,
  sourceUnitRecord: ProductRecord = record
) => {
  const heightConflict = hasEditorialSourceWorkHeightConflict(record, hasCorroboratedEditorialDistinctWorkHeights(record));
  const editorialRecord = withoutContradictoryFamilyGeneral(record);
  const editorialSourceUnit = withoutContradictoryFamilyGeneral(sourceUnitRecord);
  const verified = evidence.sourceVerified && evidence.identityVerified && !heightConflict;
  const crossedIdentity = sourceUnitRecord.providerId === record.providerId &&
    sourceUnitRecord.reference === record.reference && sourceUnitRecord.url === record.url &&
    sourceUnitRecord.condition === record.condition &&
    hasCrossedGamEditorialIdentity(sourceUnitRecord);
  const authenticatedOrigin = sourceUnitRecord.providerId === record.providerId &&
    sourceUnitRecord.reference === record.reference && sourceUnitRecord.url === record.url &&
    sourceUnitRecord.condition === record.condition;
  const originalKnowledge = authenticatedOrigin && (crossedIdentity || hasGamModelTitleDisagreement(sourceUnitRecord))
    ? resolveKnowledgeEditorial(sourceUnitRecord, sourceUnitRecord) : null;
  const variantConflict = authenticatedOrigin && hasGamCorroboratedModelVariantConflict(sourceUnitRecord);
  const sourceModelConflict = hasGamModelTitleDisagreement(sourceUnitRecord) &&
    Boolean(originalKnowledge?.general || variantConflict);
  if (variantConflict && !originalKnowledge?.general) return {
    verifiedTitle: null,
    descriptions: distinguishDescriptions(unresolvedEditorialModelVariantShort, unresolvedEditorialModelVariantGeneral),
    sourceModelConflict,
    sourceMotorConflict: false,
    heightConflict
  };
  const resolvedKnowledge = (crossedIdentity || sourceModelConflict) && originalKnowledge?.general ? originalKnowledge :
    resolveKnowledgeEditorial(record, sourceUnitRecord);
  const knowledge = verified || resolvedKnowledge.identityOverride ||
    Boolean(resolvedKnowledge.short || resolvedKnowledge.general || resolvedKnowledge.fallbackGeneral ||
      resolvedKnowledge.title) ? resolvedKnowledge : null;
  const sourceMotorConflict = authenticatedOrigin && hasUncorroboratedSignedMotor(knowledge?.fallbackGeneral ?? null);
  const sourceFamily = verified && !sourceUnitRecord.shortDescription?.trim() ?
    editorialFamilyFromSourceGeneral(sourceUnitRecord.longDescription) : null;
  const familyOverride = knowledge?.familyOverride ?? sourceFamily;
  const documentedAccessory = resolveDocumentedAccessoryEditorial(sourceUnitRecord, editorialRecord);
  const signedCapacity = verifiedMercaelevaMbCapacityProposal(editorialSourceUnit);
  const verifiedCapacityCorrection = Boolean(signedCapacity &&
    signedCapacity.expected === editorialSourceUnit.specs?.["Capacidad máxima de elevación"] &&
    signedCapacity.next === editorialRecord.specs?.["Capacidad máxima de elevación"]);
  const composingRecord = withoutUncorroboratedMotorClaim(editorialRecord, sourceMotorConflict);
  const composingSource = withoutUncorroboratedMotorClaim(editorialSourceUnit, sourceMotorConflict);
  const composed = verified ? resolveUnbrandedEditorial(composingRecord) ?? resolveReusableEditorial(composingRecord, familyOverride, composingSource) : { short: null, general: null };
  const technicalListing = /^(?:dimensiones\s+)?(?:altura|capacidad|longitud|anchura)\s*:/iu
    .test(sourceUnitRecord.longDescription?.trim() ?? "");
  const general = crossedIdentity && !originalKnowledge?.general ? null : knowledge?.general ?? documentedAccessory?.general ??
    (sourceMotorConflict ? knowledge?.fallbackGeneral : null) ??
    (verified && technicalListing ? knowledge?.fallbackGeneral : null) ??
    (verified ? resolveSourceEditorialClaims(editorialSourceUnit, editorialRecord, composed.general) : null) ??
    knowledge?.fallbackGeneral ??
    (verified ? resolveMissingTechnicalEditorialGeneral(editorialSourceUnit, editorialRecord, verifiedCapacityCorrection) : null) ?? null;
  const signedGeneral = Boolean(general &&
    (general === knowledge?.general || general === knowledge?.fallbackGeneral || general === documentedAccessory?.general));
  const recoveredShort = !record.shortDescription?.trim() ?
    documentedAccessory?.short ?? (signedGeneral && general ? conciseVerifiedUnitGeneral(sourceUnitRecord, general) ??
      conciseSignedUnitGeneral(general) : null) ??
      (verified ? resolveVerifiedSourceEditorialExcerpt(sourceUnitRecord) : null) ??
      (verified ? resolveVerifiedTechnicalBrief(sourceUnitRecord, record) : null) ??
      resolveEditorialIdentitySummary(record, familyOverride) : null;
  const narrative = general && !signedGeneral ? [knowledge?.familyGuidance, knowledge?.modelReference]
    .filter((part): part is string => Boolean(part)).join(" ") : "";
  const assembledGeneral = general ? `${general}${narrative ? ` ${narrative}` : ""}` : editorialRecord.longDescription;
  const modelDimensions = verified && !signedGeneral && isGamDocumentedYaleDimensionsSource(editorialSourceUnit) ?
    resolveDocumentedModelDimensions(editorialSourceUnit, editorialRecord, assembledGeneral) : null;
  const completedGeneral = modelDimensions ? `${modelDimensions}${assembledGeneral ? `\n\n${assembledGeneral}` : ""}` : assembledGeneral;
  const long = signedGeneral ? assembledGeneral : resolveVerifiedEditorialUnitContext(editorialSourceUnit, completedGeneral, editorialRecord);
  const conservedShort = verified && signedGeneral &&
    (hasEditorialMillimetreUnit(sourceUnitRecord.specs?.["Altura máxima de elevación"]) || technicalListing) ?
      sourceUnitRecord.shortDescription?.trim() || recoveredShort : null;
  const contextualShort = verified && !crossedIdentity && !sourceModelConflict && !knowledge?.short &&
    !conservedShort && composed.short ? corroboratedSourceUnitBrief(sourceUnitRecord, record, composed.short) : null;
  const sourceClean = cleanAuthenticatedSourceEditorial(sourceUnitRecord,
    crossedIdentity ? signedGeneral && general ? conciseSignedUnitGeneral(general) : null :
      knowledge?.short ?? conservedShort ??
      (signedGeneral && sourceUnitRecord.providerId === "gam" &&
        !sourceUnitRecord.shortDescription?.trim() && !sourceUnitRecord.longDescription?.trim() ?
        recoveredShort : null) ?? contextualShort ?? composed.short ?? record.shortDescription ?? recoveredShort,
    crossedIdentity && !signedGeneral ? null : long);
  const compact = verified && !knowledge?.short && !composed.short ?
    compressVerifiedSourceShort(sourceUnitRecord, sourceClean.short, sourceClean.general) : null;
  return {
    verifiedTitle: knowledge?.title ?? null,
    descriptions: distinguishDescriptions(compact ?? sourceClean.short, sourceClean.general),
    sourceModelConflict,
    sourceMotorConflict,
    heightConflict
  };
};

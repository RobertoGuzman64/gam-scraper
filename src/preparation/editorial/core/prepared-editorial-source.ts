import type { ProductRecord } from "../../../contracts/catalog.js";
import type { SourceEditorialEvidence } from "../claims/source-editorial-evidence.js";
import { verifiedMercaelevaMbCapacityProposal } from "../../../catalog/interventions/verified-mercaeleva-capacity.js";
import { distinguishDescriptions } from "../../../catalog/normalization/descriptions.js";
import { hasEditorialSourceWorkHeightConflict } from "../measurements/coherence/editorial-height-consistency.js";
import { hasCorroboratedEditorialDistinctWorkHeights } from "./editorial-source.js";
import { resolveReusableEditorial } from "./editorial-composition.js";
import { hasEditorialMillimetreUnit } from "../measurements/editorial-measurements.js";
import { resolveSourceEditorialClaims } from "../claims/editorial-source-claims.js";
import { resolveSourcedConciseShort } from "../writing/editorial-sourced-concise-short.js";
import { resolveSourcedShortSummary } from "../source/context/editorial-source-short-summary.js";
import { structureSourcedLongGeneral } from "../writing/editorial-sourced-long-structure.js";
import { resolveSourcedAmbiguousWidth } from "../measurements/sourced/editorial-sourced-ambiguous-dimension.js";
import { resolveSourcedShortDiscrepancy } from "../claims/editorial-sourced-short-discrepancy.js";
import { resolveUnbrandedEditorial } from "../identity/editorial-unbranded-equipment.js";
import { cleanAuthenticatedSourceEditorial } from "../writing/editorial-text-hygiene.js";
import { resolveKnowledgeEditorial } from "./knowledge-editorial.js";
import { resolvePreparedSourceGeneral } from "../source/context/prepared-source-general.js";
import { removeSourcedPromotionalClosing } from "../writing/editorial-sourced-commercial-tail.js";
import { isGamDocumentedYaleDimensionsSource } from "../../gam/identity/evidence/model-dimensions-source.js";
import { conciseVerifiedUnitGeneral, conciseSignedUnitGeneral, resolveEditorialIdentitySummary, resolveCorroboratedEditorialVariantGeneral, unresolvedEditorialModelVariantShort, unresolvedEditorialModelVariantGeneral } from "../identity/editorial-identity-summary.js";
import { compressVerifiedSourceShort, expandVerifiedSourceShort } from "../source/editorial-source-brief.js";
import { corroboratedSourceUnitBrief } from "../source/editorial-source-unit-brief.js";
import { editorialFamilyFromSourceGeneral } from "./editorial-families.js";
import { resolveVerifiedTechnicalBrief } from "../measurements/editorial-technical-brief.js";
import { resolveVerifiedSourceEditorialExcerpt } from "../source/editorial-source-excerpt.js";
import { resolveMissingTechnicalEditorialGeneral } from "../source/context/editorial-missing-technical-general.js";
import { resolveDocumentedAccessoryEditorial } from "../source/details/documented-accessory.js";
import { withoutContradictoryFamilyGeneral } from "../source/context/editorial-source-family-general.js";
import { hasUncorroboratedSignedMotor, withoutUncorroboratedMotorClaim } from "../identity/editorial-signed-motor-caution.js";
import { hasCrossedGamEditorialIdentity, hasGamCorroboratedModelVariantConflict, hasGamModelTitleDisagreement } from "../../gam/identity/evidence/gam-crossed-editorial-identity.js";

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
  const { long, modelDimensions } = resolvePreparedSourceGeneral(
    editorialSourceUnit, editorialRecord, general, knowledge, verified, signedGeneral,
    crossedIdentity || variantConflict || sourceModelConflict, authenticatedOrigin,
    () => isGamDocumentedYaleDimensionsSource(editorialSourceUnit)
  );
  const conservedShort = verified && signedGeneral &&
    (hasEditorialMillimetreUnit(sourceUnitRecord.specs?.["Altura máxima de elevación"]) || technicalListing) ?
      sourceUnitRecord.shortDescription?.trim() || recoveredShort : null;
  const contextualShort = verified && !crossedIdentity && !sourceModelConflict && !knowledge?.short &&
    !conservedShort && composed.short ? corroboratedSourceUnitBrief(sourceUnitRecord, record, composed.short) : null;
  const trimmedLong = !signedGeneral && !crossedIdentity && !variantConflict && !sourceModelConflict && !modelDimensions ?
    removeSourcedPromotionalClosing(editorialSourceUnit, editorialRecord, long, authenticatedOrigin) : null;
  const sourceClean = cleanAuthenticatedSourceEditorial(sourceUnitRecord,
    crossedIdentity ? signedGeneral && general ? conciseSignedUnitGeneral(general) : null :
      knowledge?.short ?? conservedShort ??
      (signedGeneral && sourceUnitRecord.providerId === "gam" &&
        !sourceUnitRecord.shortDescription?.trim() && !sourceUnitRecord.longDescription?.trim() ?
        recoveredShort : null) ?? contextualShort ?? composed.short ?? record.shortDescription ?? recoveredShort,
    crossedIdentity && !signedGeneral ? null : trimmedLong ?? long);
  const compact = verified && !knowledge?.short && !composed.short ?
    compressVerifiedSourceShort(sourceUnitRecord, sourceClean.short, sourceClean.general) : null;
  const expanded = verified && !knowledge?.short && !composed.short ?
    expandVerifiedSourceShort(sourceUnitRecord, compact ?? sourceClean.short) : null;
  const conciseShort = verified && !signedGeneral && !crossedIdentity && !sourceModelConflict && !knowledge?.short ?
    resolveSourcedConciseShort(editorialSourceUnit, editorialRecord, expanded ?? compact ?? sourceClean.short, sourceClean.general, authenticatedOrigin) : null;
  const shortSummary = !knowledge?.short && !crossedIdentity && !sourceModelConflict && !variantConflict ?
    resolveSourcedShortSummary(editorialSourceUnit, editorialRecord,
      conciseShort ?? expanded ?? compact ?? sourceClean.short, sourceClean.general, authenticatedOrigin) : null;
  const finalShort = shortSummary ?? conciseShort ?? expanded ?? compact ?? sourceClean.short;
  const reconciledShort = verified && !knowledge?.short && !signedGeneral && !crossedIdentity && !sourceModelConflict && !variantConflict ?
    resolveSourcedShortDiscrepancy(editorialSourceUnit, editorialRecord, finalShort, authenticatedOrigin) : null;
  const widthGeneral = authenticatedOrigin && !signedGeneral && !crossedIdentity && !variantConflict &&
    !sourceModelConflict ? resolveSourcedAmbiguousWidth(editorialSourceUnit, editorialRecord, sourceClean.general, authenticatedOrigin) : null;
  const structuredGeneral = authenticatedOrigin && !signedGeneral && !crossedIdentity &&
    !variantConflict && !sourceModelConflict && !modelDimensions ?
    structureSourcedLongGeneral(editorialSourceUnit, editorialRecord, widthGeneral ?? sourceClean.general, authenticatedOrigin) : null;
  const finalGeneral = structuredGeneral ?? widthGeneral ?? sourceClean.general;
  const variantGeneral = !signedGeneral && !crossedIdentity && !variantConflict && !sourceModelConflict && !heightConflict && !modelDimensions ?
    resolveCorroboratedEditorialVariantGeneral(sourceUnitRecord, record, finalGeneral, authenticatedOrigin) : null;
  return {
    verifiedTitle: knowledge?.title ?? null,
    descriptions: distinguishDescriptions(reconciledShort ?? finalShort, variantGeneral ?? finalGeneral),
    sourceModelConflict,
    sourceMotorConflict,
    heightConflict
  };
};

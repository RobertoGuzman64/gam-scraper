import type { ProductRecord } from "../../../contracts/catalog.js";
import type { SourceEditorialEvidence } from "../claims/source-editorial-evidence.js";
import { verifiedMercaelevaMbCapacityProposal } from "../../../catalog/interventions/verified-mercaeleva-capacity.js";
import { distinguishDescriptions } from "../../../catalog/normalization/descriptions.js";
import { hasEditorialSourceWorkHeightConflict } from "../measurements/coherence/editorial-height-consistency.js";
import { hasCorroboratedEditorialDistinctWorkHeights } from "./editorial-source.js";
import { resolveReusableEditorial } from "./editorial-composition.js";
import { hasEditorialMillimetreUnit } from "../measurements/editorial-measurements.js";
import { resolveSourceEditorialClaims } from "../claims/editorial-source-claims.js";
import { resolveHeaderOnlyEditorialGeneral } from "../source/context/editorial-header-only-general.js";
import { resolveSourcedUnitMeasuresGeneral } from "../measurements/sourced/editorial-sourced-unit-measures.js";
import { resolveSourcedTechnicalContext } from "../measurements/sourced/editorial-sourced-technical-context.js";
import { resolveSourcedConciseShort } from "../writing/editorial-sourced-concise-short.js";
import { resolveSourcedShortSummary } from "../source/context/editorial-source-short-summary.js";
import { resolveSourcedOperationalSpecs } from "../source/details/editorial-sourced-operational-specs.js";
import { resolveSourcedShortContext } from "../source/context/editorial-source-short-context.js";
import { resolveSourcedShortClaimsGeneral } from "../claims/editorial-sourced-short-claims.js";
import { resolveSourcedLongEvidence } from "../claims/editorial-sourced-long-evidence.js";
import { synthesizeSourcedLongGeneral } from "../source/context/editorial-source-general-synthesis.js";
import { resolveSourcedOperationalFeatures } from "../source/details/editorial-sourced-operational-features.js";
import { structureSourcedLongGeneral } from "../writing/editorial-sourced-long-structure.js";
import { resolveSourcedAmbiguousWidth } from "../measurements/sourced/editorial-sourced-ambiguous-dimension.js";
import { removeSourcedPromotionalClosing } from "../writing/editorial-sourced-commercial-tail.js";
import { resolveSourcedShortDiscrepancy } from "../claims/editorial-sourced-short-discrepancy.js";
import { resolveSourcedFamilyContext } from "../source/context/editorial-sourced-family-context.js";
import { resolveUnbrandedEditorial } from "../identity/editorial-unbranded-equipment.js";
import { resolveVerifiedEditorialUnitContext } from "../identity/editorial-unit-context.js";
import { cleanAuthenticatedSourceEditorial } from "../writing/editorial-text-hygiene.js";
import { resolveKnowledgeEditorial } from "./knowledge-editorial.js";
import { conciseVerifiedUnitGeneral, conciseSignedUnitGeneral, resolveEditorialIdentitySummary, unresolvedEditorialModelVariantShort, unresolvedEditorialModelVariantGeneral } from "../identity/editorial-identity-summary.js";
import { compressVerifiedSourceShort, expandVerifiedSourceShort } from "../source/editorial-source-brief.js";
import { corroboratedSourceUnitBrief } from "../source/editorial-source-unit-brief.js";
import { editorialFamilyFromSourceGeneral } from "./editorial-families.js";
import { resolveVerifiedTechnicalBrief } from "../measurements/editorial-technical-brief.js";
import { resolveVerifiedSourceEditorialExcerpt } from "../source/editorial-source-excerpt.js";
import { resolveMissingTechnicalEditorialGeneral } from "../source/context/editorial-missing-technical-general.js";
import { resolveDocumentedAccessoryEditorial } from "../source/details/documented-accessory.js";
import { withoutContradictoryFamilyGeneral } from "../source/context/editorial-source-family-general.js";
import { resolveDocumentedModelDimensions } from "../measurements/editorial-model-dimensions.js";
import { hasUncorroboratedSignedMotor, withoutUncorroboratedMotorClaim } from "../identity/editorial-signed-motor-caution.js";
import { hasCrossedGamEditorialIdentity, hasGamCorroboratedModelVariantConflict, hasGamModelTitleDisagreement } from "../../gam/identity/evidence/gam-crossed-editorial-identity.js";
import { isGamDocumentedYaleDimensionsSource } from "../../gam/identity/evidence/model-dimensions-source.js";

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
  const familyGuidance = general?.includes("compactación de contenedores") &&
    knowledge?.familyGuidance?.includes("La compactadora se emplea en tareas de compactación del terreno o del firme.") ?
    knowledge.familyGuidance.replace("La compactadora se emplea en tareas de compactación del terreno o del firme.", "").trim() :
    knowledge?.familyGuidance;
  const narrative = general && !signedGeneral ? [familyGuidance, knowledge?.modelReference]
    .filter((part): part is string => Boolean(part)).join(" ") : "";
  const assembledGeneral = general ? `${general}${narrative ? ` ${narrative}` : ""}` :
    !crossedIdentity && !variantConflict && !sourceModelConflict && authenticatedOrigin ?
      resolveHeaderOnlyEditorialGeneral(editorialSourceUnit, editorialRecord) ?? editorialRecord.longDescription :
      editorialRecord.longDescription;
  const sourcedMeasures = verified && !signedGeneral && !crossedIdentity && !variantConflict && !sourceModelConflict ?
    resolveSourcedUnitMeasuresGeneral(editorialSourceUnit, editorialRecord, assembledGeneral, authenticatedOrigin) : null;
  const contextualGeneral = verified && !signedGeneral && !crossedIdentity && !variantConflict && !sourceModelConflict ?
    resolveSourcedFamilyContext(editorialSourceUnit, editorialRecord, sourcedMeasures ?? assembledGeneral, authenticatedOrigin) : null;
  const contextualSource = contextualGeneral ?? sourcedMeasures ?? assembledGeneral;
  const technicalSource = verified && !signedGeneral && !crossedIdentity && !variantConflict && !sourceModelConflict ?
    resolveSourcedTechnicalContext(editorialSourceUnit, editorialRecord, contextualSource, authenticatedOrigin) : null;
  const extendedSource = verified && !signedGeneral && !crossedIdentity && !variantConflict && !sourceModelConflict ?
    resolveSourcedLongEvidence(editorialSourceUnit, editorialRecord, technicalSource ?? contextualSource) : null;
  const sourceGeneral = extendedSource ?? technicalSource ?? contextualSource;
  const operationalGeneral = !signedGeneral && !crossedIdentity && !variantConflict && !sourceModelConflict ?
    resolveSourcedOperationalSpecs(editorialSourceUnit, editorialRecord, sourceGeneral, authenticatedOrigin) : null;
  const shortContext = !signedGeneral && !crossedIdentity && !variantConflict && !sourceModelConflict ?
    resolveSourcedShortContext(editorialSourceUnit, editorialRecord, operationalGeneral ?? sourceGeneral, authenticatedOrigin) : null;
  const sourcedGeneral = shortContext ?? operationalGeneral ?? sourceGeneral;
  const sourcedShortClaims = !signedGeneral && !crossedIdentity && !variantConflict && !sourceModelConflict ?
    resolveSourcedShortClaimsGeneral(editorialSourceUnit, editorialRecord, sourcedGeneral, authenticatedOrigin) : null;
  const claimsGeneral = sourcedShortClaims ?? sourcedGeneral;
  const modelDimensions = verified && !signedGeneral && isGamDocumentedYaleDimensionsSource(editorialSourceUnit) ?
    resolveDocumentedModelDimensions(editorialSourceUnit, editorialRecord, claimsGeneral) : null;
  const completedGeneral = modelDimensions ? `${modelDimensions}${claimsGeneral ? `\n\n${claimsGeneral}` : ""}` : claimsGeneral;
  const hardwareGeneral = authenticatedOrigin && !signedGeneral && !crossedIdentity && !variantConflict && !sourceModelConflict && !modelDimensions ?
    resolveSourcedOperationalFeatures(editorialSourceUnit, editorialRecord, completedGeneral, authenticatedOrigin) : null;
  const conciseGeneral = authenticatedOrigin && !signedGeneral && !crossedIdentity && !variantConflict && !sourceModelConflict && !modelDimensions ?
    (synthesizeSourcedLongGeneral(editorialSourceUnit, editorialRecord, completedGeneral, authenticatedOrigin) ??
      removeSourcedPromotionalClosing(editorialSourceUnit, editorialRecord, completedGeneral, authenticatedOrigin) ??
      hardwareGeneral) : null;
  const long = signedGeneral ? assembledGeneral :
    resolveVerifiedEditorialUnitContext(editorialSourceUnit, conciseGeneral ?? completedGeneral, editorialRecord);
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
  return {
    verifiedTitle: knowledge?.title ?? null,
    descriptions: distinguishDescriptions(reconciledShort ?? finalShort, structuredGeneral ?? widthGeneral ?? sourceClean.general),
    sourceModelConflict,
    sourceMotorConflict,
    heightConflict
  };
};

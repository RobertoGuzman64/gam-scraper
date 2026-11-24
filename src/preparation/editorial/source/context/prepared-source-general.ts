import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { resolveKnowledgeEditorial } from "../../core/knowledge-editorial.js";
import { resolveHeaderOnlyEditorialGeneral } from "./editorial-header-only-general.js";
import { resolveSourcedUnitMeasuresGeneral } from "../../measurements/sourced/editorial-sourced-unit-measures.js";
import { resolveSourcedTechnicalContext } from "../../measurements/sourced/editorial-sourced-technical-context.js";
import { resolveSourcedOperationalSpecs } from "../details/editorial-sourced-operational-specs.js";
import { resolveSourcedShortContext } from "./editorial-source-short-context.js";
import { resolveSourcedShortClaimsGeneral } from "../../claims/editorial-sourced-short-claims.js";
import { resolveSourcedLongEvidence } from "../../claims/editorial-sourced-long-evidence.js";
import { synthesizeSourcedLongGeneral } from "./editorial-source-general-synthesis.js";
import { resolveSourcedOperationalFeatures } from "../details/editorial-sourced-operational-features.js";
import { removeSourcedPromotionalClosing } from "../../writing/editorial-sourced-commercial-tail.js";
import { resolveSourcedFamilyContext } from "./editorial-sourced-family-context.js";
import { resolveVerifiedEditorialUnitContext } from "../../identity/editorial-unit-context.js";
import { resolveDocumentedModelDimensions } from "../../measurements/editorial-model-dimensions.js";

export const resolvePreparedSourceGeneral = (
  sourceUnit: ProductRecord,
  record: ProductRecord,
  general: string | null,
  knowledge: ReturnType<typeof resolveKnowledgeEditorial> | null,
  verified: boolean,
  signedGeneral: boolean,
  blockedIdentity: boolean,
  authenticatedOrigin: boolean,
  documentedDimensionSource: () => boolean
) => {
  const familyGuidance = general?.includes("compactación de contenedores") &&
    knowledge?.familyGuidance?.includes("La compactadora se emplea en tareas de compactación del terreno o del firme.") ?
    knowledge.familyGuidance.replace("La compactadora se emplea en tareas de compactación del terreno o del firme.", "").trim() :
    knowledge?.familyGuidance;
  const narrative = general && !signedGeneral ? [familyGuidance, knowledge?.modelReference]
    .filter((part): part is string => Boolean(part)).join(" ") : "";
  const assembledGeneral = general ? `${general}${narrative ? ` ${narrative}` : ""}` :
    !blockedIdentity && authenticatedOrigin ?
      resolveHeaderOnlyEditorialGeneral(sourceUnit, record) ?? record.longDescription :
      record.longDescription;
  const sourcedMeasures = verified && !signedGeneral && !blockedIdentity ?
    resolveSourcedUnitMeasuresGeneral(sourceUnit, record, assembledGeneral, authenticatedOrigin) : null;
  const contextualGeneral = verified && !signedGeneral && !blockedIdentity ?
    resolveSourcedFamilyContext(sourceUnit, record, sourcedMeasures ?? assembledGeneral, authenticatedOrigin) : null;
  const contextualSource = contextualGeneral ?? sourcedMeasures ?? assembledGeneral;
  const technicalSource = verified && !signedGeneral && !blockedIdentity ?
    resolveSourcedTechnicalContext(sourceUnit, record, contextualSource, authenticatedOrigin) : null;
  const extendedSource = verified && !signedGeneral && !blockedIdentity ?
    resolveSourcedLongEvidence(sourceUnit, record, technicalSource ?? contextualSource) : null;
  const sourceGeneral = extendedSource ?? technicalSource ?? contextualSource;
  const operationalGeneral = !signedGeneral && !blockedIdentity ?
    resolveSourcedOperationalSpecs(sourceUnit, record, sourceGeneral, authenticatedOrigin) : null;
  const shortContext = !signedGeneral && !blockedIdentity ?
    resolveSourcedShortContext(sourceUnit, record, operationalGeneral ?? sourceGeneral, authenticatedOrigin) : null;
  const sourcedGeneral = shortContext ?? operationalGeneral ?? sourceGeneral;
  const sourcedShortClaims = !signedGeneral && !blockedIdentity ?
    resolveSourcedShortClaimsGeneral(sourceUnit, record, sourcedGeneral, authenticatedOrigin) : null;
  const claimsGeneral = sourcedShortClaims ?? sourcedGeneral;
  const modelDimensions = verified && !signedGeneral && documentedDimensionSource() ?
    resolveDocumentedModelDimensions(sourceUnit, record, claimsGeneral) : null;
  const completedGeneral = modelDimensions ? `${modelDimensions}${claimsGeneral ? `\n\n${claimsGeneral}` : ""}` : claimsGeneral;
  const hardwareGeneral = authenticatedOrigin && !signedGeneral && !blockedIdentity && !modelDimensions ?
    resolveSourcedOperationalFeatures(sourceUnit, record, completedGeneral, authenticatedOrigin) : null;
  const conciseGeneral = authenticatedOrigin && !signedGeneral && !blockedIdentity && !modelDimensions ?
    (synthesizeSourcedLongGeneral(sourceUnit, record, completedGeneral, authenticatedOrigin) ??
      removeSourcedPromotionalClosing(sourceUnit, record, completedGeneral, authenticatedOrigin) ??
      hardwareGeneral) : null;
  const long = signedGeneral ? assembledGeneral :
    resolveVerifiedEditorialUnitContext(sourceUnit, conciseGeneral ?? completedGeneral, record);
  return { long, modelDimensions };
};

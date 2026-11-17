import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { SourceEditorialEvidence } from "./source-editorial-evidence.js";
import { hasCrossedGamEditorialIdentity } from "../../../gam/identity/evidence/gam-crossed-editorial-identity.js";
import { gamElevationIdentityConflict, gamElevationSourceIdentityConflict } from "../../../gam/identity/evidence/elevation-identity.js";
import { resolvePreparedEditorialTitle } from "./prepared-editorial-title.js";
import { resolvePreparedEditorialSource } from "./prepared-editorial-source.js";
import { withoutUncorroboratedMotorClaim } from "../domain/editorial-signed-motor-caution.js";
import { resolveKnowledgeEditorial } from "./knowledge-editorial.js";
import { resolveSourcedShortDiscrepancy } from "../domain/editorial-sourced-short-discrepancy.js";

export const resolvePreparedEditorial = (
  record: ProductRecord,
  sourceUnitRecord: ProductRecord,
  sourceEditorial: SourceEditorialEvidence,
  originalSource: ProductRecord = sourceUnitRecord
) => {
  const { descriptions, heightConflict, verifiedTitle, sourceModelConflict, sourceMotorConflict } = resolvePreparedEditorialSource(record, sourceEditorial, sourceUnitRecord);
  const matchingOriginal = originalSource !== sourceUnitRecord &&
    originalSource.providerId === sourceUnitRecord.providerId &&
    originalSource.reference === sourceUnitRecord.reference && originalSource.url === sourceUnitRecord.url &&
    originalSource.brand === sourceUnitRecord.brand && originalSource.model === sourceUnitRecord.model &&
    originalSource.specs?.["Capacidad de carga (kg)"] === sourceUnitRecord.specs?.["Capacidad de carga (kg)"] &&
    originalSource.shortDescription !== sourceUnitRecord.shortDescription;
  const originalSummaryMatches = originalSource !== sourceUnitRecord &&
    originalSource.providerId === sourceUnitRecord.providerId &&
    originalSource.reference === sourceUnitRecord.reference && originalSource.url === sourceUnitRecord.url &&
    originalSource.brand === sourceUnitRecord.brand && originalSource.model === sourceUnitRecord.model &&
    originalSource.condition === sourceUnitRecord.condition &&
    originalSource.shortDescription === sourceUnitRecord.shortDescription &&
    descriptions.short === originalSource.shortDescription;
  const originalShortDiscrepancy = originalSummaryMatches && originalSource.shortDescription?.length === 512 &&
    !/[.!?]$/u.test(originalSource.shortDescription) ?
      resolveSourcedShortDiscrepancy(originalSource, originalSource, originalSource.shortDescription, true) : null;
  const signedOriginal = matchingOriginal ? resolveKnowledgeEditorial(originalSource, originalSource).general : null;
  const cautionGeneral = signedOriginal && /\b(?:debe\s+(?:comprobarse|verificarse)|requiere\s+verificaci[oó]n)\b/iu.test(signedOriginal)
    ? signedOriginal : null;
  const titleRecord = withoutUncorroboratedMotorClaim(record, sourceMotorConflict);
  const title = verifiedTitle ?? resolvePreparedEditorialTitle(titleRecord, sourceUnitRecord);
  return {
    title,
    preparedShort: originalShortDiscrepancy ?? descriptions.short,
    preparedLong: cautionGeneral ?? descriptions.long,
    heightConflict,
    sourceModelConflict,
    sourceMotorConflict,
    sourceIdentityConflict: hasCrossedGamEditorialIdentity(sourceUnitRecord) || gamElevationSourceIdentityConflict(sourceUnitRecord) ||
      sourceUnitRecord.providerId === "gam" && sourceUnitRecord.brand?.toUpperCase() === "XCMG" &&
      /^XGA[\d]/iu.test(sourceUnitRecord.model ?? "") && gamElevationIdentityConflict(sourceUnitRecord)
  };
};

export type ResolvedPreparedEditorial = ReturnType<typeof resolvePreparedEditorial>;

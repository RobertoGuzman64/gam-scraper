import type { ProductTechnicalProvenance } from "../../../contracts/technical-provenance.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { SourceEditorialEvidence } from "../claims/source-editorial-evidence.js";
import { hasGamEditorialSourceIdentityConflict } from "../../gam/identity/evidence/gam-crossed-editorial-identity.js";
import { resolvePreparedEditorialTitle } from "../writing/prepared-editorial-title.js";
import { resolvePreparedEditorialSource } from "./prepared-editorial-source.js";
import { withoutUncorroboratedMotorClaim } from "../identity/editorial-signed-motor-caution.js";
import { resolveKnowledgeEditorial } from "./knowledge-editorial.js";
import { resolveSourcedShortDiscrepancy } from "../claims/editorial-sourced-short-discrepancy.js";

const sameEditorialOriginalIdentity = (original: ProductRecord, current: ProductRecord): boolean =>
  original !== current && original.providerId === current.providerId &&
  original.reference === current.reference && original.url === current.url &&
  original.brand === current.brand && original.model === current.model;

export const resolvePreparedEditorial = (
  record: ProductRecord,
  sourceUnitRecord: ProductRecord,
  sourceEditorial: SourceEditorialEvidence,
  originalSource: ProductRecord = sourceUnitRecord,
  technicalProvenance?: ProductTechnicalProvenance
) => {
  const { descriptions, heightConflict, verifiedTitle, sourceModelConflict, sourceMotorConflict } = resolvePreparedEditorialSource(record, sourceEditorial, sourceUnitRecord, originalSource, technicalProvenance);
  const matchingOriginal = sameEditorialOriginalIdentity(originalSource, sourceUnitRecord) &&
    originalSource.specs?.["Capacidad de carga (kg)"] === sourceUnitRecord.specs?.["Capacidad de carga (kg)"] &&
    originalSource.shortDescription !== sourceUnitRecord.shortDescription;
  const originalSummaryMatches = sameEditorialOriginalIdentity(originalSource, sourceUnitRecord) &&
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
    sourceIdentityConflict: hasGamEditorialSourceIdentityConflict(sourceUnitRecord)
  };
};

export type ResolvedPreparedEditorial = ReturnType<typeof resolvePreparedEditorial>;

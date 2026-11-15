import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { SourceEditorialEvidence } from "./source-editorial-evidence.js";
import { hasCrossedGamEditorialIdentity } from "../../../gam/identity/evidence/gam-crossed-editorial-identity.js";
import { gamElevationIdentityConflict, gamElevationSourceIdentityConflict } from "../../../gam/identity/evidence/elevation-identity.js";
import { resolvePreparedEditorialTitle } from "./prepared-editorial-title.js";
import { resolvePreparedEditorialSource } from "./prepared-editorial-source.js";
import { withoutUncorroboratedMotorClaim } from "../domain/editorial-signed-motor-caution.js";

export const resolvePreparedEditorial = (
  record: ProductRecord,
  sourceUnitRecord: ProductRecord,
  sourceEditorial: SourceEditorialEvidence
) => {
  const { descriptions, heightConflict, verifiedTitle, sourceModelConflict, sourceMotorConflict } = resolvePreparedEditorialSource(record, sourceEditorial, sourceUnitRecord);
  const titleRecord = withoutUncorroboratedMotorClaim(record, sourceMotorConflict);
  const title = verifiedTitle ?? resolvePreparedEditorialTitle(titleRecord, sourceUnitRecord);
  return {
    title,
    preparedShort: descriptions.short,
    preparedLong: descriptions.long,
    heightConflict,
    sourceModelConflict,
    sourceMotorConflict,
    sourceIdentityConflict: hasCrossedGamEditorialIdentity(sourceUnitRecord) || gamElevationSourceIdentityConflict(sourceUnitRecord) ||
      sourceUnitRecord.providerId === "gam" && sourceUnitRecord.brand?.toUpperCase() === "XCMG" &&
      /^XGA[\d]/iu.test(sourceUnitRecord.model ?? "") && gamElevationIdentityConflict(sourceUnitRecord)
  };
};

export type ResolvedPreparedEditorial = ReturnType<typeof resolvePreparedEditorial>;

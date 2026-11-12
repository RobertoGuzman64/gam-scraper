import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { SourceEditorialEvidence } from "./source-editorial-evidence.js";
import { gamElevationSourceIdentityConflict } from "../../../gam/identity/evidence/elevation-identity.js";
import { resolvePreparedEditorialTitle } from "./prepared-editorial-title.js";
import { resolvePreparedEditorialSource } from "./prepared-editorial-source.js";

export const resolvePreparedEditorial = (
  record: ProductRecord,
  sourceUnitRecord: ProductRecord,
  sourceEditorial: SourceEditorialEvidence
) => {
  const { descriptions, heightConflict, verifiedTitle } = resolvePreparedEditorialSource(record, sourceEditorial, sourceUnitRecord);
  const title = verifiedTitle ?? resolvePreparedEditorialTitle(record, sourceUnitRecord);
  return {
    title,
    preparedShort: descriptions.short,
    preparedLong: descriptions.long,
    heightConflict,
    sourceIdentityConflict: gamElevationSourceIdentityConflict(sourceUnitRecord)
  };
};

export type ResolvedPreparedEditorial = ReturnType<typeof resolvePreparedEditorial>;

import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { SourceEditorialEvidence } from "./source-editorial-evidence.js";
import { gamElevationSourceIdentityConflict } from "../../../gam/identity/evidence/elevation-identity.js";
import { resolvePreparedEditorialTitle } from "./prepared-editorial-title.js";
import { resolvePreparedEditorialSource } from "./prepared-editorial-source.js";
import { resolvePreparedEditorialModel } from "./prepared-editorial-model.js";
import { resolvePreparedEditorialCompletion } from "./prepared-editorial-completion.js";

export const resolvePreparedEditorial = (
  record: ProductRecord,
  sourceUnitRecord: ProductRecord,
  sourceEditorial: SourceEditorialEvidence
) => {
  const title = resolvePreparedEditorialTitle(record, sourceUnitRecord);
  const { descriptions, heightConflict } = resolvePreparedEditorialSource(record, sourceEditorial);
  const { residualCleaningShort, editorialGeneral } = resolvePreparedEditorialModel(record, descriptions);
  const { preparedShort, preparedLong } = resolvePreparedEditorialCompletion(
    record, descriptions, residualCleaningShort, editorialGeneral
  );
  return {
    title,
    preparedShort,
    preparedLong,
    heightConflict,
    sourceIdentityConflict: gamElevationSourceIdentityConflict(record)
  };
};

export type ResolvedPreparedEditorial = ReturnType<typeof resolvePreparedEditorial>;

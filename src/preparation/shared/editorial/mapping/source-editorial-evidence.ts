import type { ProductRecord } from "../../../../contracts/catalog.js";
import { verifiedEditorialIdentity } from "../domain/editorial-source-contract.js";
import { resolveEditorialSource } from "../domain/editorial-source.js";
import { isVerifiedUnbrandedEditorialSource } from "../domain/editorial-unbranded-equipment.js";

export const captureSourceEditorialEvidence = (record: ProductRecord) => ({
  identityVerified: verifiedEditorialIdentity(record) || isVerifiedUnbrandedEditorialSource(record),
  sourceVerified: resolveEditorialSource(record) !== null || isVerifiedUnbrandedEditorialSource(record)
});

export type SourceEditorialEvidence = ReturnType<typeof captureSourceEditorialEvidence>;

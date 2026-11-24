import type { ProductRecord } from "../../../contracts/catalog.js";
import { verifiedEditorialIdentity, verifiedEditorialStructuredIdentity } from "../core/editorial-source-contract.js";
import { resolveEditorialSource } from "../core/editorial-source.js";
import { isVerifiedUnbrandedEditorialSource } from "../identity/editorial-unbranded-equipment.js";

export const captureSourceEditorialEvidence = (record: ProductRecord) => ({
  identityVerified: verifiedEditorialIdentity(record) || verifiedEditorialStructuredIdentity(record) ||
    (record.providerId === "manain" && resolveEditorialSource(record) !== null) || isVerifiedUnbrandedEditorialSource(record),
  sourceVerified: resolveEditorialSource(record) !== null || isVerifiedUnbrandedEditorialSource(record)
});

export type SourceEditorialEvidence = ReturnType<typeof captureSourceEditorialEvidence>;

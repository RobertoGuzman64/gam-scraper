import type { ProductRecord } from "../../../../contracts/catalog.js";
import { matchesVerifiedEditorialProvenance } from "./verified-editorial-provenance.js";
import { verifiedFamilyProportionEditorial } from "../evidence/verified-family-proportion-editorial.js";

export const resolveVerifiedFamilyProportionEditorial = (
  record: ProductRecord,
  previousGeneral: string | null
): string | null => {
  if (!record.reference || !previousGeneral) return null;
  const entries: Readonly<Record<string, {
    readonly sourceDigest: string;
    readonly sourceUrl: string;
    readonly preparedGeneralDigest: string;
    readonly general: string;
  }>> = verifiedFamilyProportionEditorial;
  const evidence = entries[`${record.providerId}:${record.reference}`];
  if (!evidence || !matchesVerifiedEditorialProvenance(record, previousGeneral, evidence)) return null;
  return evidence.general;
};

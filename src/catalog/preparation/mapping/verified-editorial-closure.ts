import type { ProductRecord } from "../../../contracts/catalog.js";
import { matchesVerifiedEditorialProvenance } from "./verified-editorial-provenance.js";
import { verifiedEditorialClosure } from "../evidence/verified-editorial-closure.js";

export const resolveVerifiedEditorialClosure = (
  record: ProductRecord,
  previousGeneral: string | null
): string | null => {
  if (!record.reference || !previousGeneral) return null;
  const entries: Readonly<Record<string, {
    readonly sourceDigest: string;
    readonly sourceUrl: string;
    readonly preparedGeneralDigest: string;
    readonly general: string;
  }>> = verifiedEditorialClosure;
  const evidence = entries[`${record.providerId}:${record.reference}`];
  if (!evidence || !matchesVerifiedEditorialProvenance(record, previousGeneral, evidence)) return null;
  return evidence.general;
};

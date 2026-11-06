import { matchesVerifiedGeneralSource } from "./verified-editorial-provenance.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { verifiedCanonicalBriefEditorial } from "../evidence/verified-canonical-brief-editorial.js";

export const resolveVerifiedCanonicalBriefEditorial = (
  record: ProductRecord,
  previousGeneral: string | null
): string | null => {
  if (!record.reference || !previousGeneral) return null;
  const entries: Readonly<Record<string, {
    readonly sourceDigest: string;
    readonly preparedDigest: string;
    readonly sourceUrl: string;
    readonly general: string;
  }>> = verifiedCanonicalBriefEditorial;
  const evidence = entries[`${record.providerId}:${record.reference}`];
  if (!evidence || !matchesVerifiedGeneralSource(record, previousGeneral, evidence)) return null;
  return evidence.general;
};

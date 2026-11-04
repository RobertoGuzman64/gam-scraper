import type { ProductRecord } from "../../../contracts/catalog.js";
import { matchesVerifiedEditorialProvenance } from "./verified-editorial-provenance.js";
import { verifiedUnitSummaryEditorial } from "../evidence/verified-unit-summary-editorial.js";

export const resolveVerifiedUnitSummaryEditorial = (
  record: ProductRecord,
  preparedShort: string | null,
  preparedGeneral: string | null
): string | null => {
  if (!record.reference || !preparedShort || !preparedGeneral) return null;
  const evidence: Readonly<Record<string, {
    readonly sourceDigest: string;
    readonly sourceUrl: string;
    readonly preparedShortDigest: string;
    readonly preparedGeneralDigest: string;
    readonly short: string;
  }>> = verifiedUnitSummaryEditorial;
  const entry = evidence[`${record.providerId}:${record.reference}`];
  if (!entry || !matchesVerifiedEditorialProvenance(record, preparedGeneral, entry, preparedShort)) return null;
  return entry.short;
};

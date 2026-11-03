import type { ProductRecord } from "../../../contracts/catalog.js";
import { matchesVerifiedEditorialProvenance } from "./verified-editorial-provenance.js";
import { verifiedUnitContextEditorial } from "../evidence/verified-unit-context-editorial.js";

export const resolveVerifiedUnitContextEditorial = (
  record: ProductRecord,
  preparedShort: string | null,
  preparedGeneral: string | null
): { readonly short: string | null; readonly general: string | null } | null => {
  if (!record.reference || !preparedShort || !preparedGeneral) return null;
  const entries: Readonly<Record<string, {
    readonly sourceDigest: string;
    readonly sourceUrl: string;
    readonly preparedShortDigest: string;
    readonly preparedGeneralDigest: string;
    readonly short?: string;
    readonly general?: string;
  }>> = verifiedUnitContextEditorial;
  const evidence = entries[`${record.providerId}:${record.reference}`];
  if (!evidence || !matchesVerifiedEditorialProvenance(record, preparedGeneral, evidence, preparedShort)) return null;
  return { short: evidence.short ?? null, general: evidence.general ?? null };
};

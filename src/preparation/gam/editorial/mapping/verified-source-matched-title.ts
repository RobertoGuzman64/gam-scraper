import type { ProductRecord } from "../../../../contracts/catalog.js";
import { matchesVerifiedGeneralSource } from "../../../shared/editorial/mapping/verified-editorial-provenance.js";
import { verifiedGamSourceMatchedTitles } from "../evidence/verified-source-matched-titles.js";

export const resolveGamVerifiedSourceMatchedTitle = (
  record: ProductRecord,
  preparedTitle: string | null
): string | null => {
  if (record.providerId !== "gam" || !record.reference || !preparedTitle) return null;
  const entries: Readonly<Record<string, {
    readonly sourceDigest: string;
    readonly sourceUrl: string;
    readonly preparedDigest: string;
    readonly title: string;
  }>> = verifiedGamSourceMatchedTitles;
  const evidence = entries[record.reference];
  if (!evidence || !matchesVerifiedGeneralSource(record, preparedTitle, evidence)) return null;
  return evidence.title;
};

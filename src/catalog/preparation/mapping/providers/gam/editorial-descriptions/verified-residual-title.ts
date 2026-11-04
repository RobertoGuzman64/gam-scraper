import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { matchesVerifiedGeneralSource } from "../../../verified-editorial-provenance.js";
import { verifiedGamResidualTitles } from "../../../../evidence/providers/gam/editorial/verified-residual-titles.js";

export const resolveGamVerifiedResidualTitle = (
  record: ProductRecord,
  preparedTitle: string | null
): string | null => {
  if (record.providerId !== "gam" || !record.reference || !preparedTitle) return null;
  const entries: Readonly<Record<string, {
    readonly sourceDigest: string;
    readonly sourceUrl: string;
    readonly preparedDigest: string;
    readonly title: string;
  }>> = verifiedGamResidualTitles;
  const evidence = entries[record.reference];
  if (!evidence || !matchesVerifiedGeneralSource(record, preparedTitle, evidence)) return null;
  return evidence.title;
};

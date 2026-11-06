import type { ProductRecord } from "../../../../contracts/catalog.js";
import { matchesVerifiedGeneralSource } from "../../../shared/editorial/mapping/verified-editorial-provenance.js";
import { verifiedGamSourceMatchedGenerals } from "./verified-source-matched-generals.js";

export const resolveGamVerifiedSourceMatchedGeneral = (
  record: ProductRecord,
  preparedGeneral: string | null
): string | null => {
  if (record.providerId !== "gam" || !record.reference || !preparedGeneral) return null;
  const entries: Readonly<Record<string, {
    readonly sourceDigest: string;
    readonly sourceUrl: string;
    readonly preparedDigest: string;
    readonly general: string;
  }>> = verifiedGamSourceMatchedGenerals;
  const evidence = entries[record.reference];
  if (!evidence || !matchesVerifiedGeneralSource(record, preparedGeneral, evidence)) return null;
  return evidence.general;
};

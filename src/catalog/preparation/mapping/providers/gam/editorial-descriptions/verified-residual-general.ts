import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { matchesVerifiedGeneralSource } from "../../../verified-editorial-provenance.js";
import { verifiedGamResidualGenerals } from "../../../../evidence/providers/gam/editorial/verified-residual-generals.js";

export const resolveGamVerifiedResidualGeneral = (
  record: ProductRecord,
  preparedGeneral: string | null
): string | null => {
  if (record.providerId !== "gam" || !record.reference || !preparedGeneral) return null;
  const entries: Readonly<Record<string, {
    readonly sourceDigest: string;
    readonly sourceUrl: string;
    readonly preparedDigest: string;
    readonly general: string;
  }>> = verifiedGamResidualGenerals;
  const evidence = entries[record.reference];
  if (!evidence || !matchesVerifiedGeneralSource(record, preparedGeneral, evidence)) return null;
  return evidence.general;
};

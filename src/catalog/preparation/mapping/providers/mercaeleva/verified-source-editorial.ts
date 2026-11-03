import { matchesVerifiedGeneralSource } from "../../verified-editorial-provenance.js";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { verifiedMercaelevaSourceEditorial } from "../../../evidence/providers/mercaeleva/verified-source-editorial.js";

export const resolveMercaelevaVerifiedSourceEditorial = (
  record: ProductRecord,
  preparedGeneral: string | null
): string | null => {
  if (record.providerId !== "mercaeleva" || !record.reference || !preparedGeneral) return null;
  const entries: Readonly<Record<string, {
    readonly sourceDigest: string;
    readonly preparedDigest: string;
    readonly sourceUrl: string;
    readonly general: string;
  }>> = verifiedMercaelevaSourceEditorial;
  const evidence = entries[record.reference];
  if (!evidence || !matchesVerifiedGeneralSource(record, preparedGeneral, evidence)) return null;
  return evidence.general;
};

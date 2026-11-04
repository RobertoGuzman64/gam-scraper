import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { matchesVerifiedGeneralSource } from "../../verified-editorial-provenance.js";
import { verifiedGomarizModelGeneral } from "../../../evidence/providers/gomariz/verified-model-general.js";

export const resolveGomarizVerifiedModelGeneral = (
  record: ProductRecord,
  preparedGeneral: string | null
): string | null => {
  if (record.providerId !== "gomariz" || !record.reference || !preparedGeneral) return null;
  const entries: Readonly<Record<string, {
    readonly sourceDigest: string;
    readonly sourceUrl: string;
    readonly preparedDigest: string;
    readonly general: string;
  }>> = verifiedGomarizModelGeneral;
  const evidence = entries[record.reference];
  if (!evidence || !matchesVerifiedGeneralSource(record, preparedGeneral, evidence)) return null;
  return evidence.general;
};

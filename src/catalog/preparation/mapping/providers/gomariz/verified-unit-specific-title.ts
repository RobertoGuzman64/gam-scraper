import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { matchesVerifiedGeneralSource } from "../../verified-editorial-provenance.js";
import { verifiedGomarizUnitSpecificTitles } from "../../../evidence/providers/gomariz/verified-unit-specific-titles.js";

export const resolveGomarizVerifiedUnitSpecificTitle = (
  record: ProductRecord,
  preparedTitle: string | null
): string | null => {
  if (record.providerId !== "gomariz" || !record.reference || !preparedTitle) return null;
  const evidence: Readonly<Record<string, {
    readonly sourceDigest: string;
    readonly sourceUrl: string;
    readonly preparedDigest: string;
    readonly title: string;
  }>> = verifiedGomarizUnitSpecificTitles;
  const entry = evidence[record.reference];
  if (!entry || !matchesVerifiedGeneralSource(record, preparedTitle, entry)) return null;
  return entry.title;
};

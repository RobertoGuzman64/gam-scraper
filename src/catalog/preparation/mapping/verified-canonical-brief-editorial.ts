import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { verifiedCanonicalBriefEditorial } from "../evidence/verified-canonical-brief-editorial.js";

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const sourceDigest = (record: ProductRecord): string => digest(JSON.stringify({
  url: record.url,
  title: record.title,
  brand: record.brand,
  model: record.model,
  externalReference: record.externalReference,
  condition: record.condition,
  categoryKey: record.categoryKey,
  year: record.year,
  horometer: record.horometer,
  shortDescription: record.shortDescription,
  longDescription: record.longDescription,
  specs: record.specs
}));

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
  if (!evidence || record.url !== evidence.sourceUrl || sourceDigest(record) !== evidence.sourceDigest ||
    digest(previousGeneral) !== evidence.preparedDigest) return null;
  return evidence.general;
};

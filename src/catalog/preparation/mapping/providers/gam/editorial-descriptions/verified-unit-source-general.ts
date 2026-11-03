import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { verifiedGamUnitSourceGenerals } from "../../../../evidence/providers/gam/general-evidence/verified-unit-source-generals.js";

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const sourceDigest = (record: ProductRecord): string => digest(JSON.stringify({
  url: record.url,
  title: record.title,
  brand: record.brand,
  model: record.model,
  externalReference: record.externalReference,
  condition: record.condition,
  categoryKey: record.categoryKey,
  shortDescription: record.shortDescription,
  longDescription: record.longDescription,
  specs: record.specs
}));

export const resolveGamVerifiedUnitSourceGeneral = (record: ProductRecord, preparedGeneral: string | null): string | null => {
  if (record.providerId !== "gam" || !record.reference || !preparedGeneral) return null;
  const entries: Readonly<Record<string, {
    readonly sourceDigest: string;
    readonly preparedDigest: string;
    readonly sourceUrl: string;
    readonly general: string;
  }>> = verifiedGamUnitSourceGenerals;
  const evidence = entries[record.reference];
  if (!evidence || record.url !== evidence.sourceUrl || sourceDigest(record) !== evidence.sourceDigest ||
    digest(preparedGeneral) !== evidence.preparedDigest) return null;
  return evidence.general;
};

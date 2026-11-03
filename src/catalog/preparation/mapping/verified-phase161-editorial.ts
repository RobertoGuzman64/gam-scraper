import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { verifiedPhase161Editorial } from "../evidence/verified-phase161-editorial.js";

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

export const resolveVerifiedPhase161Editorial = (
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
  }>> = verifiedPhase161Editorial;
  const evidence = entries[`${record.providerId}:${record.reference}`];
  if (!evidence || record.url !== evidence.sourceUrl || sourceDigest(record) !== evidence.sourceDigest ||
    digest(preparedShort) !== evidence.preparedShortDigest ||
    digest(preparedGeneral) !== evidence.preparedGeneralDigest) return null;
  return { short: evidence.short ?? null, general: evidence.general ?? null };
};

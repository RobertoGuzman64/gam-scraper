import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../contracts/catalog.js";

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

export interface VerifiedEditorialProvenance {
  readonly sourceDigest: string;
  readonly sourceUrl: string;
  readonly preparedGeneralDigest: string;
  readonly preparedShortDigest?: string;
}

export interface VerifiedGeneralSourceEvidence {
  readonly sourceDigest: string;
  readonly sourceUrl: string;
  readonly preparedDigest: string;
}

export const matchesVerifiedGeneralSource = (
  record: ProductRecord,
  preparedGeneral: string,
  evidence: VerifiedGeneralSourceEvidence
): boolean => record.url === evidence.sourceUrl &&
  sourceDigest(record) === evidence.sourceDigest &&
  digest(preparedGeneral) === evidence.preparedDigest;

export const matchesVerifiedEditorialProvenance = (
  record: ProductRecord,
  preparedGeneral: string,
  evidence: VerifiedEditorialProvenance,
  preparedShort?: string
): boolean => record.url === evidence.sourceUrl &&
  sourceDigest(record) === evidence.sourceDigest &&
  digest(preparedGeneral) === evidence.preparedGeneralDigest &&
  (evidence.preparedShortDigest === undefined ||
    (preparedShort !== undefined && digest(preparedShort) === evidence.preparedShortDigest));

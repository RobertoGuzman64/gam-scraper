import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCanonicalProductRecords } from "../../catalog/canonical-catalog.js";
import type { ProductRecord } from "../../contracts/catalog.js";

export const accreditedSourceDatasets = [
  "gam-original",
  "gam-historical",
  "mercaeleva-original",
  "mercaeleva-historical",
  "gomariz-original",
  "gomariz-regression",
] as const;

export type AccreditedSourceDataset = typeof accreditedSourceDatasets[number];

const samples = new Map<AccreditedSourceDataset, readonly ProductRecord[]>();

export const accreditedSourceSamples = (dataset: AccreditedSourceDataset): readonly ProductRecord[] => {
  const cached = samples.get(dataset);
  if (cached) return cached;
  const path = resolve("src/testing/domain-cases/data", `${dataset}.json`);
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const products = parseCanonicalProductRecords(parsed);
  samples.set(dataset, products);
  return products;
};

export const accreditedSourceRecord = (dataset: AccreditedSourceDataset, reference: string): ProductRecord => {
  const record = accreditedSourceSamples(dataset).find((entry) => entry.reference === reference);
  if (!record) throw new Error(`${dataset}:${reference}`);
  return record;
};

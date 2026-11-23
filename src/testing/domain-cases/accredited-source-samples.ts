import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCanonicalProductRecords } from "../../catalog/canonical-catalog.js";
import type { ProductRecord } from "../../contracts/catalog.js";

export const accreditedSourceDatasets = [
  "gam-original",
  "gam-regression-supplement",
  "gam-gallery-supplement",
  "gam-source-cases",
  "gam-editorial-cases",
  "gam-short-discrepancy-source",
  "gam-verified-fuel-cases",
  "gam-technical-units-cases",
  "manain-editorial-source",
  "editorial-load-original",
  "mercaeleva-original",
  "mercaeleva-source-cases",
  "gomariz-original",
  "gomariz-regression",
  "gomariz-documented-weight",
  "gomariz-special-original",
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

let gamRegressionProducts: readonly ProductRecord[] | undefined;

export const accreditedGamRegressionSource = (): readonly ProductRecord[] => {
  gamRegressionProducts ??= [
    ...accreditedSourceSamples("gam-original"),
    ...accreditedSourceSamples("gam-regression-supplement")
  ];
  return gamRegressionProducts;
};

let gamGalleryProducts: readonly ProductRecord[] | undefined;

export const accreditedGamGallerySource = (): readonly ProductRecord[] => {
  gamGalleryProducts ??= [
    ...accreditedGamRegressionSource(),
    ...accreditedSourceSamples("gam-gallery-supplement")
  ];
  return gamGalleryProducts;
};

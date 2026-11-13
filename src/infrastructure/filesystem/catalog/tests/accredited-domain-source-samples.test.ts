import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../canonical-catalog.js";
import { accreditedSourceDatasets, accreditedSourceSamples } from "../../../../testing/domain-cases/accredited-source-samples.js";
import type { AccreditedSourceDataset } from "../../../../testing/domain-cases/accredited-source-samples.js";

const sourcePaths: Readonly<Record<AccreditedSourceDataset, string>> = {
  "gam-original": "catalogs/providers/gam/original/scrape-gam-catalog.json",
  "gam-historical": "src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json",
  "mercaeleva-original": "catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json",
  "mercaeleva-historical": "src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json",
  "gomariz-original": "catalogs/providers/gomariz/original/scrape-gomariz-catalog.json",
  "gomariz-regression": "src/testing/fixtures/gomariz/regression-143/scrape-gomariz-catalog.json",
};

for (const dataset of accreditedSourceDatasets) {
  test(`las muestras acreditadas ${dataset} reproducen exactamente la fuente canónica y su manifest`, async () => {
    const catalog = await readCanonicalCatalog(sourcePaths[dataset]);
    const source = new Map(catalog.products.map((product) => [product.reference, product]));
    const samples = accreditedSourceSamples(dataset);
    assert.ok(samples.length > 0);
    assert.ok(samples.length < catalog.products.length);
    for (const sample of samples) {
      assert.equal(sample.providerId, catalog.providerId);
      assert.ok(sample.reference);
      assert.deepEqual(sample, source.get(sample.reference), sample.reference);
    }
    assert.equal(new Set(samples.map((sample) => sample.reference)).size, samples.length);
  });
}

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runReviewCensus } from "../review-census.js";
import { readOfflinePreparation } from "../../infrastructure/filesystem/offline-preparation.js";

const catalog = "storage/scraped/gam/scrape-gam-marzo-2026-catalog.json";
const preparation = "storage/prepared/gam/scrape-gam-marzo-2026-20261022-171552-preparation.json";

test("la CLI genera el CSV trazable a partir de los archivos publicados sin modificar el catálogo", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eq-review-census-"));
  try {
    const path = join(dir, "censo.csv");
    await runReviewCensus([path, catalog, preparation]);
    const lines = (await readFile(path, "utf8")).trimEnd().split("\n");
    assert.match(lines[0] ?? "", /clasificaciones/);
    const prepared = await readOfflinePreparation(preparation, "gam");
    assert.equal(lines.length, prepared.totals.review + 1);
    assert.ok(lines.every((line) => line.startsWith('"') && line.endsWith('"')));
    await assert.rejects(runReviewCensus([path, catalog, catalog]), /preparación/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

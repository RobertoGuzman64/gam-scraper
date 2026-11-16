import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runReviewCensus } from "../review-census.js";
import { readOfflinePreparation } from "../../../infrastructure/filesystem/preparation/offline-preparation.js";

const catalog = "src/testing/fixtures/census/gam/scrape-gam-marzo-2026-catalog.json";
const preparation = "src/testing/fixtures/census/preparations/gam/scrape-gam-marzo-2026-census-preparation.json";

test("la CLI genera el censo desde una preparación reproducible sin modificar su catálogo", async () => {
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

test("el censo admite el alias portátil oficial con prefijo interno histórico y rechaza origen alterado", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eq-review-portable-"));
  try {
    const original = join(dir, "catalogs", "providers", "gam", "original");
    await mkdir(original, { recursive: true });
    const target = join(original, "scrape-gam-catalog.json");
    await Promise.all([
      copyFile(catalog, target),
      copyFile(catalog.replace("-catalog.json", "-catalog.manifest.json"),
        join(original, "scrape-gam-catalog.manifest.json")),
      copyFile(catalog.replace("-catalog.json", "-summary.json"),
        join(original, "scrape-gam-summary.json"))
    ]);
    const output = join(dir, "censo.csv");
    await runReviewCensus([output, target, preparation]);
    const lines = (await readFile(output, "utf8")).trimEnd().split("\n");
    assert.ok(lines.length > 1);
    await assert.rejects(runReviewCensus([output, target, preparation, target, preparation]), /duplicado/);
    await assert.rejects(runReviewCensus([output, target, catalog]), /preparación/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

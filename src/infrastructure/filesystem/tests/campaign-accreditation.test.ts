import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { readCampaignAccreditationSources } from "../campaign-accreditation.js";
import { readCanonicalCatalog } from "../canonical-catalog.js";
import { readOfflinePreparation } from "../offline-preparation.js";

const providers = ["gam", "gomariz", "mercaeleva"] as const;
const prefixes = ["scrape-gam-marzo-2026", "scrape-gomariz", "scrape-mercaeleva"] as const;
const paths = providers.map((providerId, index) => ({
  providerId,
  path: resolve(`storage/prepared/${providerId}/${prefixes[index]}-20261022-171552-preparation.json`)
}));
const preparations = await Promise.all(paths.map(({ providerId, path }) => readOfflinePreparation(path, providerId)));
const catalogPaths = providers.map((providerId, index) =>
  resolve(`storage/scraped/${providerId}/${prefixes[index]}-catalog.json`));
const catalogs = await Promise.all(catalogPaths.map((path) => readCanonicalCatalog(path)));
const report = {
  version: 1,
  runId: "acreditacion-prueba",
  status: "complete",
  requestedProviders: [...providers],
  providers: catalogs.map((catalog, index) => ({
    providerId: providers[index],
    status: "complete", outputDir: dirname(catalogPaths[index] ?? ""),
    outputPrefix: prefixes[index],
    startedAt: new Date(Date.parse(catalog.startedAt) - 1000).toISOString(),
    endedAt: new Date(Date.parse(catalog.endedAt) + 1000).toISOString()
  }))
};

test("acredita las tres publicaciones completas vinculadas a las preparaciones", async () => {
  const dir = await mkdtemp(join(tmpdir(), "editorial-run-"));
  try {
    const file = join(dir, "run.json");
    await writeFile(file, JSON.stringify(report));
    const result = await readCampaignAccreditationSources(file, preparations, paths);
    assert.equal(result.runId, report.runId);
    assert.deepEqual(result.sources.map((source) => source.productCount), [1008, 143, 218]);
    for (let i = 0; i < paths.length; i += 1) {
      assert.equal(result.sources[i]?.providerId, paths[i]?.providerId);
      assert.equal(result.sources[i]?.preparationSha256.length, 64);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("rechaza lotes parciales, duplicados y con preparaciones ajenas", async () => {
  const dir = await mkdtemp(join(tmpdir(), "editorial-run-invalid-"));
  try {
    const file = join(dir, "run.json");
    await writeFile(file, JSON.stringify({ ...report, status: "partial" }));
    await assert.rejects(readCampaignAccreditationSources(file, preparations, paths), /lote no acredita/);
    await writeFile(file, JSON.stringify({ ...report, providers: [report.providers[0], report.providers[0], report.providers[2]] }));
    await assert.rejects(readCampaignAccreditationSources(file, preparations, paths), /lote no acredita/);
    await writeFile(file, JSON.stringify(report));
    const altered = preparations.map((preparation) => preparation.source.providerId !== "gam" ? preparation : {
      ...preparation, source: { ...preparation.source, catalogSha256: "0".repeat(64) }
    });
    await assert.rejects(readCampaignAccreditationSources(file, altered, paths), /ajena al lote/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

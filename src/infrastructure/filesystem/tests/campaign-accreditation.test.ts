import assert from "node:assert/strict";
import test, { after } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { prepareSavedCatalog } from "../../../pipeline/preparation/prepare.js";
import { readCampaignAccreditationSources } from "../../../pipeline/campaign/accreditation-sources.js";
import { readCanonicalCatalog } from "../catalog/canonical-catalog.js";
import { readOfflinePreparation } from "../preparation/offline-preparation.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { copyCampaignTestCatalog } from "../../../pipeline/campaign/tests/campaign-catalog-fixture.js";
import { mkdir } from "node:fs/promises";

const providers = CAMPAIGN_PROVIDERS;
const prefixes = ["scrape-gam-marzo-2026", "scrape-gomariz", "scrape-mercaeleva", "scrape-manain"] as const;
const dir = await mkdtemp(join(tmpdir(), "editorial-accreditation-fixtures-"));
after(async () => rm(dir, { recursive: true, force: true }));
const catalogPaths = providers.map((providerId, index) => providerId === "manain"
  ? join(dir, "source", providerId, `${prefixes[index]}-catalog.json`)
  : resolve(`src/testing/fixtures/${providerId}/${prefixes[index]}-catalog.json`));
await mkdir(join(dir, "source", "manain"), { recursive: true });
await copyCampaignTestCatalog(resolve("src/testing/fixtures"), join(dir, "source", "manain"), "manain", "scrape-manain");
const paths = providers.map((providerId, index) => ({
  providerId,
  path: join(dir, providerId, `${prefixes[index]}-test-preparation.json`)
}));
await Promise.all(paths.map(async ({ providerId, path }, index) => prepareSavedCatalog({
  providerId, source: catalogPaths[index]!, out: path, dryRun: false, compare: null
})));
const preparations = await Promise.all(paths.map(({ providerId, path }) => readOfflinePreparation(path, providerId)));
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

test("acredita las cuatro publicaciones completas vinculadas a las preparaciones generadas", async () => {
  const file = join(dir, "run.json");
  await writeFile(file, JSON.stringify(report));
  const result = await readCampaignAccreditationSources(file, preparations, paths);
  assert.equal(result.runId, report.runId);
  assert.deepEqual(result.sources.map((source) => source.productCount), catalogs.map((catalog) => catalog.productCount));
  for (let i = 0; i < paths.length; i += 1) {
    assert.equal(result.sources[i]?.providerId, paths[i]?.providerId);
    assert.equal(result.sources[i]?.preparationSha256.length, 64);
  }
});

test("rechaza lotes parciales, duplicados y preparaciones ajenas", async () => {
  const file = join(dir, "run-invalid.json");
  await writeFile(file, JSON.stringify({ ...report, status: "partial" }));
  await assert.rejects(readCampaignAccreditationSources(file, preparations, paths), /lote no acredita/);
  await writeFile(file, JSON.stringify({ ...report, providers: [report.providers[0], report.providers[0], report.providers[2]] }));
  await assert.rejects(readCampaignAccreditationSources(file, preparations, paths), /lote no acredita/);
  await writeFile(file, JSON.stringify(report));
  const altered = preparations.map((preparation) => preparation.source.providerId !== "gam" ? preparation : {
    ...preparation, source: { ...preparation.source, catalogSha256: "0".repeat(64) }
  });
  await assert.rejects(readCampaignAccreditationSources(file, altered, paths), /ajena al lote/);
});

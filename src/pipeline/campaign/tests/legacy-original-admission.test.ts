import assert from "node:assert/strict";
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { consolidatePortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { discoverCampaign } from "../discovery/search.js";
import { inspectBeforeExtraction } from "../preflight.js";

const fixtures = resolve("src/testing/fixtures");

const populate = async (root: string, providerId: "gam" | "gomariz"): Promise<string> => {
  const prefix = providerId === "gam" ? "scrape-gam-marzo-2026" : "scrape-gomariz";
  const directory = join(root, "storage", "scraped", providerId);
  await mkdir(directory, { recursive: true });
  for (const name of [
    `${prefix}-catalog.json`, `${prefix}-catalog.manifest.json`, `${prefix}-summary.json`
  ]) {
    await copyFile(join(fixtures, providerId, name), join(directory, name));
  }
  return join(directory, `${prefix}-catalog.json`);
};

test("originales heredados idénticos a catalogs/ permiten iniciar una campaña nueva sin borrar storage", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-legacy-admission-"));
  try {
    const sources = await Promise.all([populate(root, "gam"), populate(root, "gomariz")]);
    const originalContents = await Promise.all(sources.map((source) => readFile(source)));
    for (const source of sources) await consolidatePortableOriginal(root, source);
    const partialDirectory = join(root, "storage", "scraped", "mercaeleva");
    await mkdir(partialDirectory, { recursive: true });
    const partialFile = join(partialDirectory, "scrape-mercaeleva-partial-all.csv");
    await writeFile(partialFile, "partial");

    const result = await inspectBeforeExtraction(root);
    assert.equal(result.campaign.runId, null);
    assert.equal(result.campaign.status, "none");
    assert.deepEqual(result.campaign.issues, []);
    assert.equal(result.requiresNewCampaign, false);
    for (const [index, source] of sources.entries()) {
      assert.deepEqual(await readFile(source), originalContents[index]);
    }
    assert.equal(await readFile(partialFile, "utf8"), "partial");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("un original sin copia portátil continúa bloqueando la admisión", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-legacy-unmigrated-"));
  try {
    const gam = await populate(root, "gam");
    await consolidatePortableOriginal(root, gam);
    await populate(root, "gomariz");
    const result = await discoverCampaign(root);
    assert.equal(result.runId, null);
    assert.equal(result.issues.length, 1);
    assert.match(result.issues[0]!, /gomariz/);
    assert.doesNotMatch(result.issues[0]!, /scrape-gam-marzo-2026/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("un original local divergente o una copia portátil dañada no se acepta como histórico consolidado", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-legacy-divergent-"));
  try {
    const source = await populate(root, "gam");
    await consolidatePortableOriginal(root, source);
    const summary = source.replace("-catalog.json", "-summary.json");
    const originalSummary = await readFile(summary, "utf8");
    await writeFile(summary, `${originalSummary}\n`);
    assert.match((await discoverCampaign(root)).issues.join("; "), /sin run.json/);
    await writeFile(summary, originalSummary);
    const manifest = join(root, "catalogs", "providers", "gam", "original", "scrape-gam-marzo-2026-catalog.manifest.json");
    await writeFile(manifest, "{}");
    assert.match((await discoverCampaign(root)).issues.join("; "), /sin run.json/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

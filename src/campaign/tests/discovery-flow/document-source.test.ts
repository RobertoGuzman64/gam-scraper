import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { inspectCleanupArea } from "../../../infrastructure/filesystem/campaign/campaign-cleanup.js";
import { readCampaignDocumentOrigin, verifyManainCampaignDocument, writeManainCampaignDocument } from "../../document-source.js";

const original = resolve("catalogs/providers/manain");

const fixture = async (): Promise<{ root: string; cleanup: () => Promise<void> }> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-manain-campaign-"));
  const folder = join(root, "catalogs", "providers", "manain");
  await mkdir(folder, { recursive: true });
  await cp(join(original, "original"), join(folder, "original"), { recursive: true });
  await cp(join(original, "evidence"), join(folder, "evidence"), { recursive: true });
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
};

test("el lote documental conserva 1298 máquinas y la procedencia sin simular un scraping", async () => {
  const { root, cleanup } = await fixture();
  try {
    const source = await readCampaignDocumentOrigin(root);
    const run = await writeManainCampaignDocument(root, "lote-validado", source);
    const catalog = await readCanonicalCatalog(join(run.outputDir, `${run.outputPrefix}-catalog.json`));
    assert.equal(catalog.productCount, 1298);
    assert.equal(run.products, catalog.productCount);
    assert.equal(run.origin?.stocklistSha256, source.stocklistSha256);
    await verifyManainCampaignDocument(run.outputDir, catalog, source);
    const summary = JSON.parse(await readFile(run.summaryFile, "utf8"));
    assert.equal(summary.totals.documentProducts, 1298);
    assert.equal(summary.totals.scrapedProducts, undefined);
    const inventory = await inspectCleanupArea(root,
      join(root, "storage", "scraped", "campaigns", "lote-validado"), "scraped",
      new Map([["manain", "manain-stocklist"]]));
    assert.ok(inventory && inventory.files >= 7);
  } finally { await cleanup(); }
});

test("la campaña detecta la alteración de su stocklist incluso con un canónico intacto", async () => {
  const { root, cleanup } = await fixture();
  try {
    const source = await readCampaignDocumentOrigin(root);
    const run = await writeManainCampaignDocument(root, "lote-alterado", source);
    const catalog = await readCanonicalCatalog(join(run.outputDir, `${run.outputPrefix}-catalog.json`));
    const originalFile = join(run.outputDir, "original", "manain-stocklist.json");
    await writeFile(originalFile, (await readFile(originalFile, "utf8")) + "\n");
    await assert.rejects(verifyManainCampaignDocument(run.outputDir, catalog, source), /alterado|discordante/i);
  } finally { await cleanup(); }
});

test("la captura documental aborta si el origen cambia entre la admisión y la promoción", async () => {
  const { root, cleanup } = await fixture();
  try {
    const source = await readCampaignDocumentOrigin(root);
    const target = join(root, "catalogs", "providers", "manain", "original", "manain-stocklist.json");
    await writeFile(target, (await readFile(target, "utf8")) + "\n");
    await assert.rejects(writeManainCampaignDocument(root, "lote-cambiado", source), /alterado|discordante/i);
  } finally { await cleanup(); }
});

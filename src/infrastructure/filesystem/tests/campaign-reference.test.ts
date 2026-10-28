import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readCampaignReference } from "../reference/store.js";
import { CAMPAIGN_PROVIDERS, LEGACY_CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { compareCampaignReferences } from "../../../catalog/reference/compare.js";
import type { CanonicalCatalog } from "../../../catalog/canonical-catalog.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const createReference = async (root: string, providers: readonly string[] = CAMPAIGN_PROVIDERS): Promise<void> => {
  const dir = join(root, "data", "reference");
  await mkdir(dir, { recursive: true });
  const catalogs: { providerId: string; prefix: string; scope: string; productCount: number; sha256: string }[] = [];
  for (const providerId of providers) {
    const product: ProductRecord = {
      providerId, reference: "1", url: `https://ejemplo.test/${providerId}/1`,
      categoryKey: "equipos", categoryName: "Equipos", title: "Equipo", shortDescription: null,
      longDescription: null, price: null, brand: null, model: null, year: null,
      location: null, country: null, horometer: null, serialNumber: null, image: null
    };
    const catalog: CanonicalCatalog = {
      version: 1, providerId, prefix: providerId, scope: "a".repeat(16),
      startedAt: "2026-01-01T08:00:00Z", endedAt: "2026-01-01T09:00:00Z",
      quality: { status: "complete", published: true }, productCount: 1, products: [product]
    };
    const raw = JSON.stringify(catalog);
    await writeFile(join(dir, `${providerId}.json`), raw);
    catalogs.push({ providerId, prefix: providerId, scope: catalog.scope, productCount: 1, sha256: hash(raw) });
  }
  const differences = JSON.stringify({ version: 1, baseline: "initial", currentRunId: "nuevo", previousRunId: null, providers: [] });
  await writeFile(join(dir, "differences.json"), differences);
  await writeFile(join(dir, "manifest.json"), JSON.stringify({
    version: 1, runId: "nuevo", createdAt: "2026-01-01T09:00:00Z",
    catalogs, differencesSha256: hash(differences)
  }));
};

test("lectura sin referencia no crea carpetas; valida un conjunto íntegro", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-reference-read-"));
  try {
    assert.equal(await readCampaignReference(root), null);
    await createReference(root);
    const result = await readCampaignReference(root);
    assert.equal(result?.manifest.runId, "nuevo");
    assert.deepEqual(result?.catalogs.map((entry) => entry.providerId), CAMPAIGN_PROVIDERS);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("no acepta referencia parcial ni alterada, aunque sus JSON sean válidos", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-reference-tamper-"));
  try {
    await mkdir(join(root, "data", "reference"), { recursive: true });
    await assert.rejects(readCampaignReference(root), /incompleta/);
    await createReference(root);
    const gam = join(root, "data", "reference", "gam.json");
    await writeFile(gam, (await readFile(gam, "utf8")) + " ");
    await assert.rejects(readCampaignReference(root), /Huella alterada/);
    await createReference(root);
    await writeFile(join(root, "data", "reference", "differences.json"), "{}");
    await assert.rejects(readCampaignReference(root), /informe de diferencias/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("la referencia heredada de tres proveedores sigue siendo válida y comparable con cuatro", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-reference-legacy-"));
  try {
    await createReference(root, LEGACY_CAMPAIGN_PROVIDERS);
    const legacy = await readCampaignReference(root);
    assert.ok(legacy);
    assert.deepEqual(legacy.catalogs.map((catalog) => catalog.providerId), LEGACY_CAMPAIGN_PROVIDERS);
    const manainProduct: ProductRecord = {
      providerId: "manain", reference: "MA3904",
      url: "https://manain.com/producto/venda-elevacio-tisores-jlg-530lrt/",
      categoryKey: "venta", categoryName: "Maquinaria en venta", title: "JLG 530LRT",
      shortDescription: null, longDescription: null, price: null,
      brand: "JLG", model: "530LRT", year: null, location: null, country: null,
      horometer: null, serialNumber: null, image: null
    };
    const newCatalog: CanonicalCatalog = {
      ...legacy.catalogs[0]!, providerId: "manain", prefix: "scrape-manain",
      productCount: 1, products: [manainProduct]
    };
    const result = compareCampaignReferences(legacy.manifest.runId, legacy.catalogs, "nuevo", [...legacy.catalogs, newCatalog]);
    assert.equal(result.baseline, "previous");
    assert.equal(result.providers.length, 4);
    assert.deepEqual(result.providers.map((item) => item.providerId), CAMPAIGN_PROVIDERS);
    assert.equal(result.providers[3]?.previousCount, 0);
    assert.equal(result.providers[3]?.currentCount, 1);
    assert.equal(result.providers[3]?.added.length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

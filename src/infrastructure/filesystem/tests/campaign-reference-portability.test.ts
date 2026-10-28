import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { exportCampaignReference, importCampaignReference, recoverCampaignReference } from "../../../pipeline/campaign/reference/maintenance.js";
import { inspectCampaignReference, readCampaignReference } from "../reference/store.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import type { CanonicalCatalog } from "../../../catalog/canonical-catalog.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const fixture = async (root: string, runId: string): Promise<void> => {
  const directory = join(root, "data", "reference");
  await mkdir(directory, { recursive: true });
  const catalogs: { providerId: string; prefix: string; scope: string; productCount: number; sha256: string }[] = [];
  for (const providerId of CAMPAIGN_PROVIDERS) {
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
    await writeFile(join(directory, `${providerId}.json`), raw);
    catalogs.push({ providerId, prefix: providerId, scope: catalog.scope, productCount: 1, sha256: digest(raw) });
  }
  const report = JSON.stringify({ version: 1, baseline: "initial", currentRunId: runId, previousRunId: null, providers: [] });
  await writeFile(join(directory, "differences.json"), report);
  await writeFile(join(directory, "manifest.json"), JSON.stringify({
    version: 1, runId, createdAt: "2026-01-01T09:00:00Z", catalogs, differencesSha256: digest(report)
  }));
};

const temporary = async (action: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-reference-portability-"));
  try { await action(root); }
  finally { await rm(root, { recursive: true, force: true }); }
};

test("la consulta no escribe ni requiere campaña; distingue ausente, válida y alterada", async () => temporary(async (root) => {
  assert.deepEqual(await inspectCampaignReference(root), { status: "absent" });
  assert.equal((await readdir(root)).length, 0);
  await fixture(root, "lote-a");
  const valid = await inspectCampaignReference(root);
  assert.equal(valid.status, "valid");
  if (valid.status !== "valid") throw new Error("Falta referencia íntegra");
  assert.equal(valid.reference.manifest.runId, "lote-a");
  assert.deepEqual(valid.reference.catalogs.map((entry) => entry.productCount), [1, 1, 1, 1]);
  const gam = join(root, "data", "reference", "gam.json");
  const initial = await readFile(gam, "utf8");
  await writeFile(gam, initial + " ");
  const invalid = await inspectCampaignReference(root);
  assert.equal(invalid.status, "invalid");
  assert.equal(await readFile(gam, "utf8"), initial + " ");
}));

test("detecta respaldo recuperable sin repararlo ni crear una campaña", async () => temporary(async (root) => {
  await fixture(root, "lote-b");
  const data = join(root, "data");
  await rename(join(data, "reference"), join(data, ".reference-backup"));
  const inspection = await inspectCampaignReference(root);
  assert.equal(inspection.status, "recoverable");
  if (inspection.status !== "recoverable") throw new Error("No se detectó respaldo");
  assert.equal(inspection.reference.manifest.runId, "lote-b");
  await assert.rejects(lstat(join(data, "reference")), { code: "ENOENT" });
  assert.equal((await recoverCampaignReference(root)).runId, "lote-b");
  assert.equal((await inspectCampaignReference(root)).status, "valid");
  await assert.rejects(recoverCampaignReference(root), /ya es válida/);
}));

test("recupera la copia íntegra ante una referencia activa adulterada", async () => temporary(async (root) => {
  await fixture(root, "lote-a");
  const data = join(root, "data");
  const backup = join(data, ".reference-backup");
  await rename(join(data, "reference"), backup);
  await mkdir(join(data, "reference"));
  await writeFile(join(data, "reference", "manifest.json"), "{}");
  assert.equal((await inspectCampaignReference(root)).status, "recoverable");
  assert.equal((await recoverCampaignReference(root)).runId, "lote-a");
  assert.equal((await inspectCampaignReference(root)).status, "valid");
  await assert.rejects(lstat(backup), { code: "ENOENT" });
}));

test("exporta e importa los cinco archivos con integridad sin intervención manual", async () => temporary(async (root) => {
  const source = join(root, "origen");
  const target = join(root, "destino");
  const transfer = join(root, "traslado");
  await fixture(source, "lote-origen");
  assert.equal((await exportCampaignReference(source, transfer)).runId, "lote-origen");
  assert.deepEqual((await readdir(transfer)).sort(), ["differences.json", "gam.json", "gomariz.json", "manain.json", "manifest.json", "mercaeleva.json"]);
  assert.equal((await importCampaignReference(target, transfer)).runId, "lote-origen");
  assert.equal((await readCampaignReference(target))?.manifest.runId, "lote-origen");
  assert.equal((await inspectCampaignReference(target)).status, "valid");
  await assert.rejects(importCampaignReference(target, transfer), /--sustituir/);
  assert.equal((await importCampaignReference(target, transfer, true)).runId, "lote-origen");
  assert.equal((await readdir(join(target, "data"))).length, 1);
  assert.deepEqual(await readFile(join(target, "data", "reference", "gam.json")), await readFile(join(source, "data", "reference", "gam.json")));
}));

test("rechaza importación adulterada y conserva la referencia anterior", async () => temporary(async (root) => {
  const source = join(root, "origen");
  const target = join(root, "destino");
  const transfer = join(root, "traslado");
  await fixture(source, "lote-a");
  await fixture(target, "lote-b");
  await exportCampaignReference(source, transfer);
  await writeFile(join(transfer, "gomariz.json"), "{}");
  await assert.rejects(importCampaignReference(target, transfer, true), /Huella alterada/);
  assert.equal((await readCampaignReference(target))?.manifest.runId, "lote-b");
  assert.deepEqual(await readdir(join(target, "data")), ["reference"]);
}));

test("rechaza referencias con enlaces y operaciones sobre data/", async () => temporary(async (root) => {
  const source = join(root, "origen");
  const target = join(root, "destino");
  await fixture(source, "lote-a");
  await assert.rejects(exportCampaignReference(source, join(source, "data", "traslado")), /fuera del repositorio/);
  await assert.rejects(importCampaignReference(target, join(target, "data", "reference")), /fuera del repositorio/);
  const transfer = join(root, "traslado");
  await exportCampaignReference(source, transfer);
  const gam = join(transfer, "gam.json");
  const original = join(root, "original.json");
  await copyFile(gam, original);
  await rm(gam);
  await symlink(original, gam);
  await assert.rejects(importCampaignReference(target, transfer), /archivo regular/);
  assert.deepEqual(await inspectCampaignReference(target), { status: "absent" });
}));

test("exportación no sobrescribe destinos existentes", async () => temporary(async (root) => {
  const source = join(root, "origen");
  await fixture(source, "lote-a");
  const occupied = join(root, "ocupado");
  await mkdir(occupied);
  await writeFile(join(occupied, "nota.txt"), "conservar");
  await assert.rejects(exportCampaignReference(source, occupied), { code: "EEXIST" });
  assert.equal(await readFile(join(occupied, "nota.txt"), "utf8"), "conservar");
}));

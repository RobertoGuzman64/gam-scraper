import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compareCampaignReferences } from "../../../catalog/reference/compare.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { readCampaignReference, writeCampaignReference } from "../campaign-reference.js";
import type { CanonicalCatalog } from "../../../catalog/canonical-catalog.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ReferenceCatalogSource } from "../campaign-reference.js";

const sha = (raw: string): string => createHash("sha256").update(raw).digest("hex");
const product = (providerId: string, price: string | null): ProductRecord => ({
  providerId, categoryKey: "equipos", categoryName: "Equipos", url: `https://ejemplo.test/${providerId}/1`,
  reference: "1", title: "Equipo", shortDescription: null, longDescription: null, price,
  brand: null, model: null, year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null
});
const sources = (price: string | null): ReferenceCatalogSource[] => CAMPAIGN_PROVIDERS.map((providerId) => {
  const catalog: CanonicalCatalog = {
    version: 1, providerId, prefix: `extract-${providerId}`, scope: "1".repeat(16),
    startedAt: "2026-01-01T08:00:00Z", endedAt: "2026-01-01T09:00:00Z",
    quality: { status: "complete", published: true }, productCount: 1,
    products: [product(providerId, providerId === "gam" ? price : null)]
  };
  return { providerId, catalog, raw: JSON.stringify(catalog) };
});
const start = async (root: string): Promise<void> => {
  const current = sources(null);
  await writeCampaignReference(root, "lote-1", current,
    compareCampaignReferences(null, null, "lote-1", current.map((entry) => entry.catalog)), async () => {});
};

const temporary = async (callback: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-reference-write-"));
  try { await callback(root); }
  finally { await rm(root, { recursive: true, force: true }); }
};

test("inicializa cinco archivos completos, con huellas y sin residuos de transacción", async () => temporary(async (root) => {
  assert.equal(await readCampaignReference(root), null);
  await start(root);
  const directory = join(root, "data", "referencia");
  assert.deepEqual((await readdir(directory)).sort(),
    ["gam.json", "gomariz.json", "mercaeleva.json", "manifest.json", "diferencias.json"].sort());
  assert.deepEqual(await readdir(join(root, "data")), ["referencia"]);
  const reference = await readCampaignReference(root);
  assert.equal(reference?.manifest.runId, "lote-1");
  assert.equal(reference?.manifest.catalogs[0]?.sha256, sha(await readFile(join(directory, "gam.json"), "utf8")));
}));

test("sustituye el conjunto como unidad y conserva solo el último informe", async () => temporary(async (root) => {
  await start(root);
  const previous = await readCampaignReference(root);
  assert.ok(previous);
  const current = sources("500");
  const comparison = compareCampaignReferences(previous.manifest.runId, previous.catalogs, "lote-2",
    current.map((entry) => entry.catalog));
  assert.equal(comparison.providers[0]?.modified.length, 1);
  await writeCampaignReference(root, "lote-2", current, comparison, async () => {});
  const updated = await readCampaignReference(root);
  assert.equal(updated?.manifest.runId, "lote-2");
  assert.equal(updated?.catalogs[0]?.products[0]?.price, "500");
  const report: unknown = JSON.parse(await readFile(join(root, "data", "referencia", "diferencias.json"), "utf8"));
  assert.deepEqual(report, comparison);
  assert.deepEqual(await readdir(join(root, "data")), ["referencia"]);
}));

test("rechaza modificaciones en el origen antes de promoción y mantiene intacta la referencia", async () => temporary(async (root) => {
  await start(root);
  const before = await readFile(join(root, "data", "referencia", "manifest.json"), "utf8");
  const previous = await readCampaignReference(root);
  assert.ok(previous);
  const current = sources("900");
  const comparison = compareCampaignReferences(previous.manifest.runId, previous.catalogs, "lote-2",
    current.map((entry) => entry.catalog));
  await assert.rejects(writeCampaignReference(root, "lote-2", current, comparison,
    async () => { throw new Error("La entrega cambió"); }), /La entrega cambió/);
  assert.equal(await readFile(join(root, "data", "referencia", "manifest.json"), "utf8"), before);
  assert.deepEqual(await readdir(join(root, "data")), ["referencia"]);
}));

test("recupera una interrupción después de mover la referencia anterior, sin tocar el catálogo vigente en lectura", async () => temporary(async (root) => {
  await start(root);
  const data = join(root, "data");
  await rename(join(data, "referencia"), join(data, ".referencia-anterior"));
  await mkdir(join(data, ".referencia-candidata"));
  await writeFile(join(data, ".referencia-candidata", "incompleto.json"), "{}");
  assert.equal((await readCampaignReference(root))?.manifest.runId, "lote-1");
  assert.deepEqual((await readdir(data)).sort(), [".referencia-anterior", ".referencia-candidata"].sort());
  const prior = await readCampaignReference(root);
  assert.ok(prior);
  const current = sources("400");
  const comparison = compareCampaignReferences(prior.manifest.runId, prior.catalogs, "lote-2",
    current.map((entry) => entry.catalog));
  await writeCampaignReference(root, "lote-2", current, comparison, async () => {});
  assert.equal((await readCampaignReference(root))?.manifest.runId, "lote-2");
  assert.deepEqual(await readdir(data), ["referencia"]);
}));

test("descarta un respaldo pendiente tras una promoción completa, solo después de validarlo", async () => temporary(async (root) => {
  await start(root);
  const data = join(root, "data");
  await rename(join(data, "referencia"), join(data, ".referencia-anterior"));
  const previous = await readCampaignReference(root);
  assert.ok(previous);
  const current = sources("450");
  const comparison = compareCampaignReferences(previous.manifest.runId, previous.catalogs, "lote-2",
    current.map((entry) => entry.catalog));
  await mkdir(join(data, "referencia"));
  for (const file of await readdir(join(data, ".referencia-anterior"))) {
    await writeFile(join(data, "referencia", file), await readFile(join(data, ".referencia-anterior", file)));
  }
  assert.equal((await readCampaignReference(root))?.manifest.runId, "lote-1");
  await writeCampaignReference(root, "lote-2", current, comparison, async () => {});
  assert.deepEqual(await readdir(data), ["referencia"]);
}));

test("rechaza referencias manipuladas y candidatos no coincidentes sin escribir datos", async () => temporary(async (root) => {
  await start(root);
  const previous = await readCampaignReference(root);
  assert.ok(previous);
  const current = sources("350");
  const mismatched = compareCampaignReferences(null, null, "lote-2", current.map((entry) => entry.catalog));
  await assert.rejects(writeCampaignReference(root, "lote-2", current, mismatched, async () => {}), /cambió desde la comparación/);
  assert.equal((await readCampaignReference(root))?.manifest.runId, "lote-1");
  const raw = await readFile(join(root, "data", "referencia", "gam.json"), "utf8");
  await writeFile(join(root, "data", "referencia", "gam.json"), `${raw} `);
  await assert.rejects(readCampaignReference(root), /Huella alterada/);
  const comparison = compareCampaignReferences(previous.manifest.runId, previous.catalogs, "lote-2",
    current.map((entry) => entry.catalog));
  await assert.rejects(writeCampaignReference(root, "lote-2", current, comparison, async () => {}), /Huella alterada/);
}));

test("un bloqueo concurrente impide sustituir la referencia y no genera residuos", async () => temporary(async (root) => {
  await start(root);
  const previous = await readCampaignReference(root);
  assert.ok(previous);
  const current = sources("250");
  const comparison = compareCampaignReferences(previous.manifest.runId, previous.catalogs, "lote-2",
    current.map((entry) => entry.catalog));
  const lock = join(root, "data", ".referencia-bloqueo");
  await writeFile(lock, JSON.stringify({ pid: process.pid }));
  await assert.rejects(writeCampaignReference(root, "lote-2", current, comparison, async () => {}), /Otra actualización/);
  assert.equal((await readCampaignReference(root))?.manifest.runId, "lote-1");
  await rm(lock);
  await writeCampaignReference(root, "lote-2", current, comparison, async () => {});
  assert.equal((await readCampaignReference(root))?.manifest.runId, "lote-2");
}));

test("si la referencia activa está dañada y existe respaldo íntegro, se recupera antes de actualizar", async () => temporary(async (root) => {
  await start(root);
  const data = join(root, "data");
  await mkdir(join(data, ".referencia-anterior"));
  for (const file of await readdir(join(data, "referencia"))) {
    await writeFile(join(data, ".referencia-anterior", file), await readFile(join(data, "referencia", file)));
  }
  await writeFile(join(data, "referencia", "gam.json"), "{}");
  const previousRaw = await readFile(join(data, ".referencia-anterior", "manifest.json"), "utf8");
  const previous: unknown = JSON.parse(previousRaw);
  if (!previous || typeof previous !== "object" || !("runId" in previous) || typeof previous.runId !== "string") {
    throw new Error("Manifiesto de respaldo de prueba inválido");
  }
  assert.equal(previous.runId, "lote-1");
  const current = sources("450");
  const referenceCatalogs = sources(null).map((entry) => entry.catalog);
  const comparison = compareCampaignReferences(previous.runId, referenceCatalogs, "lote-2",
    current.map((entry) => entry.catalog));
  await writeCampaignReference(root, "lote-2", current, comparison, async () => {});
  assert.equal((await readCampaignReference(root))?.manifest.runId, "lote-2");
  assert.deepEqual(await readdir(data), ["referencia"]);
}));

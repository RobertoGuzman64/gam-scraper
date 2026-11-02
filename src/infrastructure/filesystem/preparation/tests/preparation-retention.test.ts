import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../../../contracts/scraping.js";
import { writeOutputs } from "../../../../pipeline/publication/publish.js";
import { prepareSavedCatalog } from "../../../../pipeline/preparation/prepare.js";
import { offlinePreparationManifest } from "../offline-preparation.js";
import { simulatePreparedRetention } from "../preparation-retention.js";
import { formatRetentionSimulation } from "../../../../cli/reporting/retention-simulation.js";

const category: CategoryConfig = { key: "maquinas", name: "Maquinaria", url: "https://example.test/maquinas" };
const product = (id: number): ProductRecord => ({
  providerId: "gam", categoryKey: category.key, categoryName: category.name,
  url: `https://example.test/maquina/${id}`, title: `Máquina ${id}`,
  shortDescription: null, longDescription: null, price: null, reference: `GAM-${id}`,
  brand: null, model: null, year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null, condition: null, images: [], specs: {}
});

const withWorkspace = async (run: (root: string, source: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-retention-f3-"));
  try {
    const source = join(root, "storage", "scraped", "gam", "lote-catalog.json");
    const products = Array.from({ length: 12 }, (_, index) => product(index + 1));
    const result: CategoryScrapeResult = { category, discoveredProductUrls: products.length, products, failures: [] };
    await writeOutputs(join(root, "storage", "scraped", "gam"), "lote", [result], "2026-10-21T12:00:00Z", "2026-10-21T12:00:00Z");
    await run(root, source);
  } finally { await rm(root, { recursive: true, force: true }); }
};

const saveVersion = async (root: string, source: string, index: number): Promise<string> => {
  const path = join(root, "storage", "prepared", "gam", `lote-v${index}-preparation.json`);
  const result = await prepareSavedCatalog({ providerId: "gam", source, out: path, dryRun: false, compare: null });
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (typeof parsed !== "object" || parsed === null || !("preparedAt" in parsed)) throw new Error("Fixture de preparación inválido");
  const current = { ...parsed, preparedAt: `2026-10-${String(index).padStart(2, "0")}T12:00:00Z` };
  const text = JSON.stringify(current, null, 2);
  await writeFile(path, text);
  await writeFile(result.manifestFile, offlinePreparationManifest(text, result.preparation));
  return path;
};

test("simula la retención de tres versiones completas sin borrar ningún archivo", async () => {
  await withWorkspace(async (root, source) => {
    const paths = await Promise.all([1, 2, 3].map((index) => saveVersion(root, source, index)));
    const before = await Promise.all(paths.map((path) => readFile(path)));
    const result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.kept, 2);
    assert.equal(result.candidates, 1);
    assert.equal(result.candidateFiles, 3);
    assert.equal(result.protected, 0);
    assert.equal(result.actualDeletions, 0);
    assert.deepEqual(result.versions.filter((item) => item.action === "candidato").map((item) => item.id), ["lote-v1"]);
    assert.deepEqual(await Promise.all(paths.map((path) => readFile(path))), before);
    assert.ok(formatRetentionSimulation("gam", result).includes("Eliminaciones reales: 0"));
  });
});

test("una acreditación con SHA completo de preparación protege el conjunto referido", async () => {
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    const hash = createHash("sha256").update(await readFile(first)).digest("hex");
    const directory = join(root, "catalogs", "providers", "gam", "publications");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "active.json"), JSON.stringify({ preparationSha256: hash }));
    const result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.protected, 1);
    assert.equal(result.candidates, 0);
    assert.match(result.versions[0]?.reason ?? "", /Referenciada/);
  });
});

test("preparación inválida, manifest ausente y entradas desconocidas se bloquean", async () => {
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    await rm(first.replace(/-preparation\.json$/, "-preparation.manifest.json"));
    let result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.protected, 1);
    assert.equal(result.candidates, 0);
    await writeFile(join(root, "storage", "prepared", "gam", "extra-archivo.dat"), "desconocido");
    result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.protected, 3);
    assert.equal(result.candidates, 0);
  });
});

test("referencias en rutas gestionadas, ilegibles o enlazadas bloquean candidatos", async () => {
  await withWorkspace(async (root, source) => {
    await saveVersion(root, source, 1);
    await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    const runs = join(root, "storage", "runs");
    await mkdir(runs, { recursive: true });
    await writeFile(join(runs, "attachment.zip"), "contenido no inspeccionable");
    const result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.protected, 3);
    assert.equal(result.candidates, 0);
    await rm(join(runs, "attachment.zip"));
    await symlink(join(root, "storage", "prepared", "gam"), join(runs, "enlace"), "dir");
    const linked = await simulatePreparedRetention(root, "gam");
    assert.equal(linked.protected, 3);
    assert.equal(linked.candidates, 0);
  });
});

test("solo admite la raíz autorizada; el almacén preparado enlazado se rechaza", async () => {
  await withWorkspace(async (root, source) => {
    await saveVersion(root, source, 1);
    await assert.rejects(simulatePreparedRetention(root, "gam", join(root, "otro")), /predeterminado/);
    const path = join(root, "storage", "prepared", "gam");
    await rm(path, { recursive: true });
    await symlink(join(root, "storage", "scraped", "gam"), path, "dir");
    await assert.rejects(simulatePreparedRetention(root, "gam"), /enlazada/);
    assert.equal((await lstat(path)).isSymbolicLink(), true);
  });
});

test("un directorio inexistente devuelve cero sin crear estructuras", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-retention-empty-"));
  try {
    const result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.candidates, 0);
    assert.equal(result.actualDeletions, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

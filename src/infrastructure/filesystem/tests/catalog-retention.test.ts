import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../../contracts/scraping.js";
import { writeOutputs } from "../../../pipeline/publication/publish.js";
import { categoryScope } from "../../../catalog/quality.js";
import { catalogArchiveExcess, cleanCatalogExcess } from "../catalog/catalog-retention.js";

const category: CategoryConfig = { key: "venta", name: "Venta", url: "https://test.example/venta" };
const item = (reference: string, price: string): ProductRecord => ({
  providerId: "proveedor-prueba", categoryKey: category.key, categoryName: category.name,
  url: `https://test.example/${reference}`, title: `Máquina ${reference}`,
  shortDescription: null, longDescription: null, price, reference, brand: null, model: null,
  year: null, location: null, country: null, horometer: null, serialNumber: null, image: null, specs: {}
});
const products = (price: string): CategoryScrapeResult => ({
  category, discoveredProductUrls: 12, failures: [],
  products: Array.from({ length: 12 }, (_, index) => item(`REF-${index + 1}`, price))
});
const stamp = (day: number): string => `2026-10-${String(day).padStart(2, "0")}T10:00:00Z`;
const withDir = async (run: (dir: string) => Promise<void>): Promise<void> => {
  const dir = await mkdtemp(join(tmpdir(), "retencion-catalogo-"));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
};
const archives = async (dir: string): Promise<readonly string[]> => {
  const names = await readdir(join(dir, ".history", "inventario"));
  return names.filter((name) => name.startsWith("archive-")).sort();
};

test("rotación conserva publicación actual y dos anteriores con CSV, preparación y snapshot", async () => {
  await withDir(async (dir) => {
    for (let n = 1; n <= 4; n += 1) {
      await writeOutputs(dir, "inventario", [products(`${n * 1000} €`)], stamp(n), stamp(n));
    }
    const names = await archives(dir);
    assert.equal(names.length, 2);
    const archiveDir = join(dir, ".history", "inventario", names[0]!);
    const oldCsv = await readFile(join(archiveDir, "inventario-all.csv"), "utf8");
    assert.ok(oldCsv.includes("2000 €"));
    assert.ok((await readFile(join(archiveDir, "inventario-preparation.json"), "utf8")).includes("quality"));
    assert.ok((await readFile(join(archiveDir, `inventario-snapshot-${categoryScope([category])}.json`), "utf8")).includes("items"));
    assert.ok((await readFile(join(dir, "inventario-all.csv"), "utf8")).includes("4000 €"));
    assert.equal((await catalogArchiveExcess(dir, "inventario")).length, 0);
  });
});

test("extracción bloqueada no rota el catálogo y siguiente publicación usa metadatos válidos", async () => {
  await withDir(async (dir) => {
    await writeOutputs(dir, "inventario", [products("1000 €")], stamp(1), stamp(1));
    const snapshotPath = join(dir, `inventario-snapshot-${categoryScope([category])}.json`);
    const snapshot = await readFile(snapshotPath, "utf8");
    const failure: CategoryScrapeResult = {
      ...products("2000 €"), discoveredProductUrls: 12,
      failures: [{ url: "https://test.example/error", error: "HTTP 503" }]
    };
    await assert.rejects(writeOutputs(dir, "inventario", [failure], stamp(2), stamp(2)), /Extracción partial/);
    assert.equal((await archives(dir)).length, 0);
    assert.equal(await readFile(snapshotPath, "utf8"), snapshot);
    await writeOutputs(dir, "inventario", [products("3000 €")], stamp(3), stamp(3));
    const names = await archives(dir);
    assert.equal(names.length, 1);
    assert.ok((await readFile(join(dir, ".history", "inventario", names[0]!, "inventario-all.csv"), "utf8")).includes("1000 €"));
    assert.ok((await readFile(join(dir, "inventario-all.csv"), "utf8")).includes("3000 €"));
  });
});

test("limpieza solo elimina restos parciales de una publicación completa", async () => {
  await withDir(async (dir) => {
    await writeOutputs(dir, "inventario", [products("1000 €")], stamp(1), stamp(1));
    const partial = join(dir, "inventario-partial-all.csv");
    const unrelated = join(dir, "inventario-antiguo-partial-all.csv");
    await writeFile(partial, "parcial");
    await writeFile(unrelated, "personal");
    const expected = await cleanCatalogExcess(dir, "inventario", true);
    assert.deepEqual(expected.map((candidate) => candidate.path), [partial]);
    assert.equal(await readFile(partial, "utf8"), "parcial");
    await cleanCatalogExcess(dir, "inventario", false);
    await assert.rejects(readFile(partial, "utf8"), { code: "ENOENT" });
    assert.equal(await readFile(unrelated, "utf8"), "personal");
  });
});

test("limpieza opcional de prefijos antiguos mantiene snapshots y archivos sin prefijo reconocido", async () => {
  await withDir(async (dir) => {
    await writeOutputs(dir, "inventario", [products("1000 €")], stamp(4), stamp(4));
    const oldSummary = join(dir, "legacy-summary.json");
    const oldCsv = join(dir, "legacy-all.csv");
    const oldSnapshot = join(dir, "legacy-snapshot-seguro.json");
    await writeFile(oldSummary, JSON.stringify({ startedAt: stamp(1) }));
    await writeFile(oldCsv, "datos anteriores");
    await writeFile(oldSnapshot, "snapshot anterior");
    const { cleanLegacyCatalogExcess } = await import("../catalog/catalog-retention.js");
    assert.deepEqual((await cleanLegacyCatalogExcess(dir, "inventario", true)).map((candidate) => candidate.path).sort(),
      [oldSummary, oldCsv].sort());
    await cleanLegacyCatalogExcess(dir, "inventario", false);
    await assert.rejects(readFile(oldCsv, "utf8"), { code: "ENOENT" });
    assert.equal(await readFile(oldSnapshot, "utf8"), "snapshot anterior");
  });
});

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../../contracts/scraping.js";
import { categoryScope } from "../../../catalog/quality.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { writeCategoriesCsv, writeGroupedOutputs, writeOutputs } from "../publish.js";

const category: CategoryConfig = {
  key: "maquinaria", name: "Maquinaria", url: "https://example.test/catalogo"
};
const product = (reference: string): ProductRecord => ({
  providerId: "gam", categoryKey: category.key, categoryName: category.name,
  url: `https://example.test/maquina/${reference}`,
  reference, title: `Máquina ${reference}`, shortDescription: null,
  longDescription: null, price: null, brand: null, model: null, year: null,
  location: null, country: null, horometer: null, serialNumber: null,
  image: null, images: [], specs: { Peso: "100 kg" }
});
const result = (items: readonly ProductRecord[], failures: CategoryScrapeResult["failures"] = []): CategoryScrapeResult => ({
  category, discoveredProductUrls: items.length, products: items, failures
});
const start = "2026-10-01T10:00:00Z";
const end = "2026-10-01T10:01:00Z";
const withDir = async (operation: (dir: string) => Promise<void>): Promise<void> => {
  const dir = await mkdtemp(join(tmpdir(), "equipzilla-output-"));
  try { await operation(dir); } finally { await rm(dir, { recursive: true, force: true }); }
};

test("la restauración publica CSV con las cabeceras contractuales y preserva el modo agrupado", async () => {
  await withDir(async (dir) => {
    await writeCategoriesCsv(dir, "lote", [category]);
    assert.equal((await readFile(join(dir, "lote-categories.csv"), "utf8")).split("\n")[0],
      "categoryKey,categoryName,categoryUrl");
    const items = [product("A"), product("B")];
    await writeGroupedOutputs(dir, "lote", [{ parent: category, results: [result(items)] }], start, end);
    const catalog = await readCanonicalCatalog(join(dir, "lote-catalog.json"));
    assert.equal(catalog.scope, categoryScope([category], "grouped"));
    assert.deepEqual(catalog.products, items);
    const csv = await readFile(join(dir, "lote-all.csv"), "utf8");
    assert.match(csv, /^categoryKey,categoryName,title,/);
    assert.match(csv, /imagesJson/);
    assert.match(csv, /specJson/);
  });
});

test("una publicación parcial no sustituye los originales ni las huellas activas", async () => {
  await withDir(async (dir) => {
    await writeOutputs(dir, "lote", [result([product("A")])], start, end);
    const paths = ["lote-all.csv", "lote-catalog.json", "lote-catalog.manifest.json", "lote-preparation.json"];
    const before = await Promise.all(paths.map((name) => readFile(join(dir, name))));
    await assert.rejects(writeOutputs(dir, "lote", [result([product("B")], [
      { url: "https://example.test/error", error: "HTTP 503" }
    ])], start, end), /Extracción partial/);
    for (const [index, name] of paths.entries()) {
      assert.deepEqual(await readFile(join(dir, name)), before[index]);
    }
    const active = await readCanonicalCatalog(join(dir, "lote-catalog.json"));
    assert.equal(active.products[0]?.reference, "A");
  });
});

test("las fechas inválidas se rechazan antes de modificar la publicación", async () => {
  await withDir(async (dir) => {
    await writeOutputs(dir, "lote", [result([product("A")])], start, end);
    const before = await readFile(join(dir, "lote-summary.json"));
    await assert.rejects(writeOutputs(dir, "lote", [result([product("B")])], "fecha-invalida", end), /contrato inválido/);
    assert.deepEqual(await readFile(join(dir, "lote-summary.json")), before);
  });
});

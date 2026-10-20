import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeGroupedOutputs, writeOutputs } from "../publish.js";
import { categoryScope } from "../../../catalog/quality.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../../contracts/scraping.js";

import type { ProductRecord } from "../../../contracts/catalog.js";

const category: CategoryConfig = { key: "venta", name: "Maquinaria usada", url: "https://test.example/venta" };
const secondCategory: CategoryConfig = { key: "segunda", name: "Segunda", url: "https://test.example/segunda" };
const time = "2026-10-15T10:00:00Z";

const product = (reference: string, price = "1000 €"): ProductRecord => ({
  providerId: "proveedor-prueba", categoryKey: category.key, categoryName: category.name,
  url: `https://test.example/maquina/${reference}`, title: `Máquina ${reference}`,
  shortDescription: null, longDescription: null, price, reference, brand: null, model: null,
  year: null, location: null, country: null, horometer: null, serialNumber: null, image: null, specs: {}
});

const categoryResult = (products: readonly ProductRecord[], failures: CategoryScrapeResult["failures"] = []): CategoryScrapeResult => ({
  category, products, discoveredProductUrls: products.length + failures.length, failures
});

const initial = (): readonly ProductRecord[] =>
  Array.from({ length: 12 }, (_, index) => product(`STOCK-${index + 1}`));

const withOutputDir = async (run: (dir: string) => Promise<void>): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), "scraper-phase3-"));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
};

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));

const asObject = (value: unknown): Record<string, unknown> => {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
};

const readSnapshot = (folder: string): Promise<string> =>
  readFile(join(folder, `inventario-snapshot-${categoryScope([category])}.json`), "utf8");

test("primera extracción sana publica CSV y establece snapshot separado por ámbito", async () => {
  await withOutputDir(async (folder) => {
    await writeOutputs(folder, "inventario", [categoryResult(initial())], time, time);
    const summary = asObject(await readJson(join(folder, "inventario-summary.json")));
    assert.equal(asObject(summary.quality).status, "complete");
    assert.equal(asObject(summary.totals).scrapedProducts, 12);
    const changes = asObject(await readJson(join(folder, "inventario-changes.json")));
    assert.equal(changes.baseline, "new");
    assert.equal((changes.added as readonly string[]).length, 12);
    assert.deepEqual(changes.suspectedMissing, []);
    const snapshot = asObject(JSON.parse(await readSnapshot(folder)));
    assert.equal((snapshot.items as readonly unknown[]).length, 12);
  });
});

test("segunda extracción detecta nuevas, actualizadas y posiblemente ausentes sin borrar productos", async () => {
  await withOutputDir(async (folder) => {
    await writeOutputs(folder, "inventario", [categoryResult(initial())], time, time);
    const modified = [...initial().slice(1)];
    modified[0] = product("STOCK-2", "1200 €");
    modified.push(product("STOCK-13"));
    await writeOutputs(folder, "inventario", [categoryResult(modified)], time, time);
    const changes = asObject(await readJson(join(folder, "inventario-changes.json")));
    assert.equal(changes.baseline, "previous");
    assert.deepEqual(changes.added, ["proveedor-prueba:ref:stock-13"]);
    assert.deepEqual(changes.updated, ["proveedor-prueba:ref:stock-2"]);
    assert.deepEqual(changes.suspectedMissing, ["proveedor-prueba:ref:stock-1"]);
    assert.equal((asObject(await readJson(join(folder, "inventario-summary.json"))).quality as Record<string, unknown>).published, true);
  });
});

test("los fallos parciales conservan el último CSV y snapshot; generan diagnóstico y CSV parcial", async () => {
  await withOutputDir(async (folder) => {
    await writeOutputs(folder, "inventario", [categoryResult(initial())], time, time);
    const beforeCsv = await readFile(join(folder, "inventario-all.csv"), "utf8");
    const beforeSnapshot = await readSnapshot(folder);
    const failure = [{ url: "https://test.example/maquina/error", error: "HTTP 503" }];
    await assert.rejects(writeOutputs(folder, "inventario", [categoryResult(initial().slice(0, 11), failure)], time, time), /Extracción partial/);
    assert.equal(await readFile(join(folder, "inventario-all.csv"), "utf8"), beforeCsv);
    assert.equal(await readSnapshot(folder), beforeSnapshot);
    assert.ok((await readFile(join(folder, "inventario-partial-all.csv"), "utf8")).includes("STOCK-2"));
    const errors = asObject(await readJson(join(folder, "inventario-errors.json")));
    assert.equal((errors.failures as readonly unknown[]).length, 1);
    const changes = asObject(await readJson(join(folder, "inventario-changes.json")));
    assert.equal(changes.status, "not-comparable");
    assert.deepEqual(changes.suspectedMissing, []);
  });
});

test("respuesta vacía o caída de más del 50 % bloquea la publicación aunque no haya errores HTTP", async () => {
  await withOutputDir(async (folder) => {
    await writeOutputs(folder, "inventario", [categoryResult(initial())], time, time);
    const before = await readFile(join(folder, "inventario-all.csv"), "utf8");
    await assert.rejects(writeOutputs(folder, "inventario", [categoryResult([])], time, time), /Extracción blocked/);
    await assert.rejects(writeOutputs(folder, "inventario", [categoryResult(initial().slice(0, 3))], time, time), /Caída anómala/);
    assert.equal(await readFile(join(folder, "inventario-all.csv"), "utf8"), before);
    assert.equal((asObject(await readJson(join(folder, "inventario-summary.json"))).quality as Record<string, unknown>).status, "blocked");
  });
});

test("no usa un snapshot corrupto ni compara ámbitos diferentes", async () => {
  await withOutputDir(async (folder) => {
    await writeOutputs(folder, "inventario", [categoryResult(initial())], time, time);
    const firstSnapshot = await readSnapshot(folder);
    const secondResult: CategoryScrapeResult = {
      category: secondCategory, discoveredProductUrls: 1, products: [{ ...product("STOCK-20"), categoryKey: secondCategory.key }], failures: []
    };
    await writeOutputs(folder, "inventario", [secondResult], time, time);
    assert.equal(asObject(await readJson(join(folder, "inventario-changes.json"))).baseline, "new");
    assert.equal(await readSnapshot(folder), firstSnapshot);
    await writeFile(join(folder, `inventario-snapshot-${categoryScope([category])}.json`), "{}", "utf8");
    await assert.rejects(writeOutputs(folder, "inventario", [categoryResult(initial())], time, time), /Snapshot de catálogo inválido/);
  });
});

test("extracciones agrupadas con subcategoría fallida conservan el CSV agregado anterior", async () => {
  await withOutputDir(async (folder) => {
    await writeGroupedOutputs(folder, "inventario", [{ parent: category, results: [categoryResult(initial())] }], time, time);
    const before = await readFile(join(folder, "inventario-all.csv"), "utf8");
    const broken: CategoryScrapeResult = {
      category: secondCategory, discoveredProductUrls: 0, products: [], failures: [{ url: secondCategory.url, error: "Error de listado" }]
    };
    await assert.rejects(writeGroupedOutputs(folder, "inventario", [
      { parent: category, results: [categoryResult(initial()), broken] }
    ], time, time), /Extracción blocked/);
    assert.equal(await readFile(join(folder, "inventario-all.csv"), "utf8"), before);
  });
});


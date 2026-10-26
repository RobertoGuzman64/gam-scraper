import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";

const sourcePaths = [
  "src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json",
  "src/testing/fixtures/gomariz/scrape-gomariz-catalog.json",
  "src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json"
] as const;

test("Las muestras de los tres proveedores preservan las reconciliaciones y bloqueos acreditados", async () => {
  const [catalog, sources] = await Promise.all([
    loadImportCatalog(),
    Promise.all(sourcePaths.map((path) => readCanonicalCatalog(path)))
  ]);
  const batches = sources.map(({ products }) => prepareImportBatch(products, catalog));

  assert.deepEqual(batches.map(({ totals }) => totals), [
    { ready: sources[0]!.products.length - 2, review: 2 },
    { ready: sources[1]!.products.length, review: 0 },
    { ready: sources[2]!.products.length - 1, review: 1 }
  ]);

  const all = batches.flatMap(({ products }) => products);
  assert.equal(all.length, sources.reduce((sum, source) => sum + source.productCount, 0));
  assert.equal(new Set(all.map(({ product }) => `${product.providerId}:${product.reference}`)).size, all.length);
  assert.equal(all.filter(({ status }) => status === "ready").length, all.length - 3);
  assert.ok(all.filter(({ status }) => status === "ready").every(({ issues }) => issues.length === 0));

  const get = (providerId: string, reference: string) => {
    const result = all.find(({ product }) => product.providerId === providerId && product.reference === reference);
    assert.ok(result, `${providerId}:${reference}`);
    return result;
  };

  for (const reference of ["2364", "2311", "2312", "6806", "6807", "6835", "6858"]) {
    const result = get("gam", reference);
    assert.equal(result.status, "ready", reference);
    assert.deepEqual(result.issues, [], reference);
  }

  for (const reference of [
    "5710", "2737", "2738", "3130", "3131", "2071", "3134", "2240", "6723", "2211",
    "6702", "6272", "2237", "6834", "6887", "4004", "6622", "4750", "4802", "4751",
    "4737", "4736", "4752", "2072", "2073", "6236", "2314", "2313", "2312"
  ]) {
    assert.equal(get("gam", reference).status, "ready", reference);
  }
  for (const reference of ["M062-8951", "M119-9334", "M582-1882"]) {
    assert.equal(get("mercaeleva", reference).status, "ready", reference);
  }

  assert.equal(get("mercaeleva", "M104-0836").status, "ready");
  for (const reference of ["6682", "6703"]) {
    const result = get("gam", reference);
    assert.equal(result.status, "review", reference);
    assert.ok(result.issues.some((issue) => issue.includes("Número de serie")), reference);
  }

  const linde = get("mercaeleva", "M827-8304");
  assert.equal(linde.status, "review");
  assert.deepEqual([...linde.issues].sort(), [
    "Atributo contradictorio: Capacidad de carga",
    "Atributo contradictorio: Tipo de mástil",
    "MER0798: el anuncio del vendedor publica 4.800 kg y mástil dúplex en el texto, pero 3.000 kg y mástil tríplex en los campos técnicos; la republicación en Machineryline conserva ambas discrepancias. Confirmar capacidad efectiva y mástil instalado con el vendedor o la placa antes de validar la ficha"
  ].sort());
});

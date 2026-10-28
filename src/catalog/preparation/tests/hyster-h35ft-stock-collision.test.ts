import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { findSerialNumberCollisions } from "../../identity-conflicts.js";
import { describeHysterH35ftStockConflict } from "../evidence/providers/gam/hyster-h35ft-serial-evidence.js";
import { prepareImportBatch } from "../batch-identity.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const get = (reference: string): ProductRecord => {
  const item = gam.products.find((product) => product.reference === reference);
  assert.ok(item, reference);
  return item;
};
const first = get("6682");
const second = get("6703");
const collisionFor = (products: readonly ProductRecord[]) =>
  findSerialNumberCollisions(products).find(({ serialNumber }) => serialNumber === "P177B10585U");

test("ambas referencias GAM conservan su serie y el conflicto de stock se explica sin liberar máquinas", () => {
  const originals = structuredClone([first, second]);
  const collision = collisionFor([second, first]);
  assert.ok(collision);
  assert.match(describeHysterH35ftStockConflict(collision) ?? "", /GAM-11596.*GAM-11594.*placa/);
  const result = prepareImportBatch([first, second], catalog);
  assert.deepEqual(result.totals, { ready: 0, review: 2 });
  for (const prepared of result.products) {
    assert.equal(prepared.status, "review");
    assert.ok(prepared.issues.some((issue) => issue.includes("Número de serie P177B10585U compartido")));
    assert.ok(prepared.issues.some((issue) => issue.includes("Stock GAM diferenciado")));
  }
  assert.deepEqual(result.products.map(({ product }) => product.spec), [first.specs, second.specs]);
  assert.deepEqual([first, second], originals);
});

test("variantes de origen no heredan el diagnóstico de stocks acreditados", () => {
  const changes: readonly [ProductRecord, ProductRecord][] = [
    [{ ...first, externalReference: "GAM-11594" }, second],
    [{ ...first, horometer: "22498 horas" }, second],
    [{ ...first, location: "MURCIA" }, second],
    [{ ...first, image: "https://example.test/change.jpg" }, second],
    [{ ...first, images: first.images?.slice(1) ?? [] }, second],
    [{ ...first, specs: { ...first.specs, "Horómetro": "22498 horas" } }, second],
    [first, { ...second, externalReference: "GAM-11596" }],
    [first, { ...second, url: `${second.url}?v=2` }],
    [first, { ...second, shortDescription: "Texto diferente" }],
    [first, { ...second, specs: { ...second.specs, "Nº de serie": "P177B10585V" } }]
  ];
  for (const [index, pair] of changes.entries()) {
    const collision = collisionFor(pair);
    assert.ok(collision, String(index));
    assert.equal(describeHysterH35ftStockConflict(collision), null, String(index));
    const result = prepareImportBatch(pair, catalog);
    assert.deepEqual(result.totals, { ready: 0, review: 2 }, String(index));
    assert.ok(result.products.every(({ issues }) => issues.some((issue) => issue.includes("Número de serie"))), String(index));
    assert.ok(result.products.every(({ issues }) => issues.every((issue) => !issue.includes("Stock GAM diferenciado"))), String(index));
  }
});

test("la inclusión de una tercera referencia no se considera un conflicto acreditado de dos stocks", () => {
  const third: ProductRecord = { ...first, reference: "6999" };
  const collision = collisionFor([first, second, third]);
  assert.ok(collision);
  assert.equal(describeHysterH35ftStockConflict(collision), null);
  const result = prepareImportBatch([first, second, third], catalog);
  assert.deepEqual(result.totals, { ready: 0, review: 3 });
  assert.ok(result.products.every(({ issues }) => issues.some((issue) => issue.includes("Número de serie"))));
  assert.ok(result.products.every(({ issues }) => issues.every((issue) => !issue.includes("Stock GAM diferenciado"))));
});

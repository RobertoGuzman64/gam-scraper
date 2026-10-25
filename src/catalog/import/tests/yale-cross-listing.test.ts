import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { findSerialNumberCollisions } from "../../identity-conflicts.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { verifiedYaleErp35vlCrossListing } from "../mapping/providers/gam/yale-erp35vl-serial-evidence.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const get = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};
const older = get("6835");
const newer = get("6858");
const collisionFor = (records: readonly ProductRecord[]) =>
  findSerialNumberCollisions(records).find(({ serialNumber }) => serialNumber === "A976B08243T");

test("las dos fichas Yale publicadas con stock GAM-27262 conservan VIN y datos originales", () => {
  const original = structuredClone([older, newer]);
  const collision = collisionFor([newer, older]);
  assert.ok(collision);
  assert.equal(verifiedYaleErp35vlCrossListing(collision), true);
  const result = prepareImportBatch([older, newer], catalog);
  assert.deepEqual(result.totals, { ready: 2, review: 0 });
  assert.deepEqual(result.products.map(({ product }) => product.reference), ["6835", "6858"]);
  assert.ok(result.products.every(({ status, issues }) => status === "ready" && issues.length === 0));
  assert.deepEqual(result.products.map(({ product }) => product.spec), [older.specs, newer.specs]);
  assert.equal(older.serialNumber, newer.serialNumber);
  assert.equal(older.horometer, "1660 horas");
  assert.equal(newer.horometer, "1662 horas");
  assert.deepEqual([older, newer], original);
});

test("las variantes no acreditadas mantienen el bloqueo por serie", () => {
  const cases: readonly [ProductRecord, ProductRecord][] = [
    [{ ...older, url: `${older.url}?variant=1` }, newer],
    [{ ...older, externalReference: "GAM-27262" }, newer],
    [{ ...older, horometer: "1662 horas" }, newer],
    [{ ...older, price: "15000" }, newer],
    [{ ...older, image: "https://example.test/change.jpg" }, newer],
    [older, { ...newer, images: newer.images?.slice(0, 1) ?? [] }],
    [{ ...older, specs: { ...older.specs, "Horómetro": "1600 horas" } }, newer],
    [{ ...older, shortDescription: "Texto cambiado" }, newer],
    [older, { ...newer, url: `${newer.url}?variant=1` }],
    [older, { ...newer, externalReference: "GAM-99999" }],
    [older, { ...newer, specs: { ...newer.specs, "Tipo Mástil": "TRIPLEX" } }],
    [older, { ...newer, longDescription: "Texto cambiado" }]
  ];
  for (const [index, pair] of cases.entries()) {
    const collision = collisionFor(pair);
    assert.ok(collision, String(index));
    assert.equal(verifiedYaleErp35vlCrossListing(collision), false, String(index));
    const result = prepareImportBatch(pair, catalog);
    assert.deepEqual(result.totals, { ready: 0, review: 2 }, String(index));
    assert.ok(result.products.every(({ issues }) => issues.some((issue) => issue.includes("Número de serie"))), String(index));
  }
});

test("una tercera ficha con el mismo VIN bloquea las tres identidades", () => {
  const third: ProductRecord = { ...older, reference: "6999" };
  const collision = collisionFor([older, newer, third]);
  assert.ok(collision);
  assert.equal(verifiedYaleErp35vlCrossListing(collision), false);
  const result = prepareImportBatch([older, newer, third], catalog);
  assert.deepEqual(result.totals, { ready: 0, review: 3 });
  assert.ok(result.products.every(({ issues }) => issues.some((issue) => issue.includes("Número de serie"))));
});

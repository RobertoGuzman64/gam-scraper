import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { findSerialNumberCollisions } from "../../identity-conflicts.js";
import { reconcileGamVerifiedZeroSerial, verifiedZeroMisattributedSerial } from "../mapping/providers/gam/musoshi-serial-evidence.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";

const catalog = await loadImportCatalog();
const [gam, gomariz, mercaeleva] = await Promise.all([
  readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json"),
  readCanonicalCatalog("storage/scraped/gomariz/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json")
]);
const get = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};
const musoshi = get("6806");
const zero = get("6807");
const collisionFor = (records: readonly ProductRecord[]) =>
  findSerialNumberCollisions(records).find(({ serialNumber }) => serialNumber === "NRXL3AALS10000101");

test("F43: Zero acreditada sin VIN inventado y sin alterar datos canónicos", () => {
  const original = structuredClone([musoshi, zero]);
  const collision = collisionFor([musoshi, zero]);
  assert.ok(collision);
  assert.strictEqual(verifiedZeroMisattributedSerial(collision), zero);
  const normalized = reconcileGamVerifiedZeroSerial(zero);
  assert.notStrictEqual(normalized, zero);
  assert.equal(normalized.serialNumber, null);
  assert.equal(Object.hasOwn(normalized.specs ?? {}, "Nº de serie"), false);
  assert.equal(normalized.specs?.["Matrícula"], "2722MHH");
  assert.equal(normalized.specs?.["Kilómetros"], "5837 KM");
  const prepared = prepareImportBatch([musoshi, zero], catalog);
  assert.deepEqual(prepared.totals, { ready: 2, review: 0 });
  assert.deepEqual(prepared.products[0]?.product.spec, musoshi.specs);
  assert.equal(prepared.products[1]?.status, "ready");
  assert.deepEqual(prepared.products[1]?.issues, []);
  assert.deepEqual(prepared.products[1]?.product.spec, normalized.specs);
  assert.deepEqual([musoshi, zero], original);
});

test("F43: variantes de Zero no heredan la excepción de la ficha acreditada", () => {
  const variants: readonly ProductRecord[] = [
    { ...zero, url: `${zero.url}?updated=1` },
    { ...zero, providerId: "gomariz" },
    { ...zero, reference: "6808" },
    { ...zero, categoryKey: "manutencion" },
    { ...zero, externalReference: "INQ-04289" },
    { ...zero, title: "Zero Motorcycles S" },
    { ...zero, brand: "MUSOSHI" },
    { ...zero, model: "DS 15" },
    { ...zero, year: "2024" },
    { ...zero, location: "VALENCIA" },
    { ...zero, price: "10000" },
    { ...zero, shortDescription: "Datos revisados" },
    { ...zero, longDescription: "Datos revisados" },
    { ...zero, specs: { ...zero.specs, "Matrícula": "3009MMS" } },
    { ...zero, specs: { ...zero.specs, "Kilómetros": "5838 KM" } },
    { ...zero, specs: { ...zero.specs, "Nº de serie": "538SDJZ6NPCG12345" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileGamVerifiedZeroSerial(variant), variant, String(index));
    const collision = collisionFor([musoshi, variant]);
    if (!collision) continue;
    assert.equal(verifiedZeroMisattributedSerial(collision), null, String(index));
    const batch = prepareImportBatch([musoshi, variant], catalog);
    assert.equal(batch.products[1]?.status, "review", String(index));
  }
});

test("F43: modificar identidad Musoshi o añadir un tercer VIN mantiene bloqueada Zero", () => {
  const variants: readonly ProductRecord[] = [
    { ...musoshi, url: `${musoshi.url}?updated=1` },
    { ...musoshi, externalReference: "INQ-04324" },
    { ...musoshi, specs: { ...musoshi.specs, "Matrícula": "2722MHH" } }
  ];
  for (const [index, variant] of variants.entries()) {
    const collision = collisionFor([variant, zero]);
    assert.ok(collision);
    assert.equal(verifiedZeroMisattributedSerial(collision), null, String(index));
    assert.equal(prepareImportBatch([variant, zero], catalog).products[1]?.status, "review", String(index));
  }
  const third = { ...zero, reference: "6808" };
  const tripletCollision = collisionFor([musoshi, zero, third]);
  assert.ok(tripletCollision);
  assert.equal(verifiedZeroMisattributedSerial(tripletCollision), null);
  assert.deepEqual(prepareImportBatch([musoshi, zero, third], catalog).totals, { ready: 0, review: 3 });
});

test("F43: 1369 identidades, 1366 ready y tres revisiones justificadas", () => {
  const result = [gam, gomariz, mercaeleva].map(({ products }) => prepareImportBatch(products, catalog));
  assert.deepEqual(result.map(({ totals }) => totals), [
    { ready: 1006, review: 2 },
    { ready: 143, review: 0 },
    { ready: 217, review: 1 }
  ]);
  const all = result.flatMap(({ products }) => products);
  assert.equal(all.length, 1369);
  assert.equal(new Set(all.map(({ product }) => `${product.providerId}:${product.reference}`)).size, 1369);
  assert.equal(all.find(({ product }) => product.reference === "6807")?.status, "ready");
  for (const reference of ["6682", "6703", "M827-8304"]) {
    assert.equal(all.find(({ product }) => product.reference === reference)?.status, "review", reference);
  }
});

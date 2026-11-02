import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const expected = new Map<string, string>([
  ["2336", "fedf9b3aff9b5c0bcdbdb01506f8a6d2831ae09327c1941b8c48788790edff09"],
  ["2337", "0489bc8d3b0f92a292f72571b9571d7e2d79b3ed8771902d7a6958fe0a7f59e4"],
  ["3443", "aa08718eb0274d09e17a90cd20899a7e59fe6a4fccecb524f687c2192b3aec69"],
  ["3444", "6031b7d82c9e0d1e3c9e84e6eba42cfb83977319d4487d06c54c2c119604ae0a"],
  ["2040", "0b41c31d84b89b415ab53d3ad4803c4c98625250ee0acb7234c47f059a597ccb"],
  ["2051", "c5c4499b0abcbc90dc76e15ad944cc4b2cf85dfa3c219f49072ba1413ec91763"],
  ["2055", "2fe1fc9cf909f9e6bb35a4c35008cc5f68d4ac30412ed10999b40f914a087538"],
  ["2124", "ce5bfcc49082c1a38e2650a0047ba0336fe050a137cf0d1472481dd3c561e1cd"],
  ["2226", "bb92e24fefd33b2ec6ee2b90c77ec8fbe6e6ce73884919b1d0c7510482d497aa"],
  ["2216", "f09dc3a47f455f3163bbf95257d71625fcf3f02e54fc8e4e7a0a12f6ded025ca"],
  ["2129", "bde49cb5a889595eacab5c43171de314e07d09ec19975a329dd023b299d134ab"],
  ["28", "798d7d19dc76dbf32fb1daec69e1591a19af818bcf4c9fd6daee04e634a5b5ec"],
  ["2299", "13fd3bdc924f0bbcb85ec59f67684e6c6c7a07b1eedb730bb030aea96525ad95"],
  ["29", "fb2c008e9152d5f95065687eae69cdb8b907f62deed501d0f75a2d9ab83295f9"],
  ["24", "14905d0079983362b63a3ceea9cb4c0f318ee560ef1d792c240f41005076b400"],
  ["2142", "5e9a60ce8c9ea06f50db2b8fab5df393e1bf9d51b6364f0c9c65ce9a66fa3fab"],
  ["26", "45df47943ea40d7a385689558bd4e179d9923d28c7ecff1022296535ea26d1cb"],
  ["23", "e3e1ff01f5e2e086085fdaf4da34e68192630578e4fc146e0950791b2654de36"],
  ["27", "301b6e681566b5092dc085f6d5ff33eb3f21d010250c341f66ee3f31473f85ce"],
  ["2257", "b9e065ca5705555e1043f9f7592e2fd0ad387767685598a1ee25663404113045"],
]);
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("fase 92: 20 fichas GAM con descripciones individuales respaldadas por el origen", () => {
  assert.equal(expected.size, 20);
  for (const [reference, hash] of expected) {
    const record = find(reference);
    const original = JSON.stringify(record);
    const product = prepareSourceProduct(record).product;
    assert.ok(product.description_general, reference);
    assert.equal(digest(product.description_general), hash, reference);
    assert.ok(product.description_general.split(/\s+/u).length >= 65, reference);
    assert.ok(record.longDescription && product.description_general.length < record.longDescription.length, reference);
    assert.equal(JSON.stringify(record), original, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.equal(product.spec[key], value, `${reference}: ${key}`);
    }
  }
});

test("fase 92: impide reutilizar redacciones de otra identidad o fuente", () => {
  for (const [reference, hash] of expected) {
    const record = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: "OTRA" },
      { ...record, url: `${record.url}?revision=nueva` },
      { ...record, title: `${record.title} variante` },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO MODELO" },
      { ...record, shortDescription: `${record.shortDescription} nuevo` },
      { ...record, longDescription: `${record.longDescription} nueva` },
      { ...record, specs: { ...record.specs, Modelo: "OTRO MODELO" } }
    ];
    for (const variant of variants) {
      const general = prepareSourceProduct(variant).product.description_general;
      assert.notEqual(digest(general ?? ""), hash, reference);
    }
  }
});

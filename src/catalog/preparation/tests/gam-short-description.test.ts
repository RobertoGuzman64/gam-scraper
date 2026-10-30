import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamShortDescription } from "../mapping/providers/gam/short-description.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const words = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;
const numbers = (value: string): ReadonlySet<string> => new Set(value.match(/\d+(?:[.,]\d+)*/gu) ?? []);

const expected = new Set([
  "6814", "6815", "6874", "6873", "6953", "6954", "6190", "6192", "6020",
  "2368", "2369", "2370", "4019", "4020", "4021", "4022", "4025", "4027",
  "4033", "4034", "4012", "2373", "3425", "4035", "4036", "4037", "4038", "4040"
]);

test("GAM: resume exclusivamente fichas seguras sin retirar cifras de la descripción combinada", () => {
  const changed = new Set<string>();
  for (const record of catalog.products) {
    const original = JSON.stringify(record);
    const shortened = resolveGamShortDescription(record);
    const prepared = prepareSourceProduct(record);
    if (shortened !== null) {
      assert.ok(record.reference);
      changed.add(record.reference);
      assert.equal(prepared.product.description, shortened, record.reference);
      assert.ok(words(shortened) >= 12 && words(shortened) <= 45, record.reference);
      assert.notEqual(shortened, record.title);
      assert.ok(prepared.product.description_general);
      const total = `${shortened} ${prepared.product.description_general}`;
      for (const figure of numbers(record.shortDescription ?? "")) {
        assert.ok(numbers(total).has(figure), `${record.reference}: falta ${figure}`);
      }
      assert.deepEqual(prepared.product.spec, record.specs);
      assert.equal(prepared.product.reference, record.reference);
      assert.equal(prepared.product.sourceUrl, record.url);
    }
    assert.equal(JSON.stringify(record), original);
  }
  assert.equal(catalog.products.length, 983);
  assert.deepEqual(changed, expected);
});

test("GAM: las generales acreditadas permiten enriquecer solo los dos módulos de baño", () => {
  for (const reference of ["6814", "6815"]) {
    const record = find(reference);
    const short = resolveGamShortDescription(record);
    const general = prepareSourceProduct(record).product.description_general;
    assert.ok(short && general);
    assert.ok(general.startsWith(short));
    for (const key of ["Longitud", "Anchura", "Altura"]) {
      const value = record.specs?.[key];
      assert.ok(typeof value === "string");
      assert.ok(short.includes(value));
    }
  }
});

test("GAM: descarta discrepancias de identidad, URL, campos técnicos y texto de origen", () => {
  const sweeper = find("4025");
  const lift = find("6874");
  const bathroom = find("6814");
  const changes: readonly ProductRecord[] = [
    { ...sweeper, providerId: "gomariz" },
    { ...sweeper, reference: "4026" },
    { ...sweeper, url: sweeper.url.replace("online.gamrentals.com", "example.com") },
    { ...sweeper, url: `${sweeper.url}?source=other` },
    { ...sweeper, title: "Barredora TENNANT BCS S780" },
    { ...sweeper, model: "BCS S780" },
    { ...sweeper, brand: "Otra marca" },
    { ...sweeper, externalReference: "BCS S780" },
    { ...sweeper, specs: { ...sweeper.specs, Modelo: "BCS S780" } },
    { ...sweeper, specs: { ...sweeper.specs, Marca: ["TENNANT"] } },
    { ...sweeper, shortDescription: sweeper.shortDescription?.replace("6.300", "8.300") ?? null },
    { ...sweeper, longDescription: "Texto general sin prestaciones documentadas" },
    { ...lift, title: "Plataforma sobre furgón CTE VJ14 FIB" },
    { ...lift, model: "VJ14 FIB" },
    { ...bathroom, specs: { ...bathroom.specs, Altura: "24000 mm" } },
    { ...bathroom, shortDescription: "MÓDULO BAÑO DOBLE WC" },
    { ...bathroom, url: bathroom.url.replace("online.gamrentals.com", "example.com") }
  ];
  for (const [index, changed] of changes.entries()) {
    assert.equal(resolveGamShortDescription(changed), null, String(index));
  }
  for (const reference of ["5949", "4026", "4029", "4030", "171", "5710", "6623", "5254", "6688", "6689", "6690"]) {
    assert.equal(resolveGamShortDescription(find(reference)), null, reference);
  }
});

test("GAM: ninguna corrección de título durante la preparación legitima el original contradictorio", () => {
  const original = find("8");
  assert.equal(resolveGamShortDescription(original), null);
  assert.equal(prepareSourceProduct(original).product.description, original.shortDescription?.trim() ?? null);
});

test("GAM: no modifica los originales Gomariz ni las fichas publicadas Mercaeleva", async () => {
  const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
  assert.equal(gomariz.products.length, 143);
  for (const record of gomariz.products) assert.equal(resolveGamShortDescription(record), null);
  const mercaeleva: ProductRecord = { ...find("4025"), providerId: "mercaeleva" };
  assert.equal(resolveGamShortDescription(mercaeleva), null);
});

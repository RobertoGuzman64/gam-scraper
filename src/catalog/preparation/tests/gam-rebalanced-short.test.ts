import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { rebalanceGamOverlongShort } from "../mapping/providers/gam/short-description.js";
import { resolveGamTecnacarGeneral } from "../mapping/providers/gam/tecnacar-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const expected = new Set([
  "6218", "6477", "6262", "6478", "6479", "6813", "6811", "6803",
  "6802", "5950", "5952", "5953", "5918", "6805", "298"
]);
const words = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;
const numericTokens = (value: string): ReadonlySet<string> =>
  new Set(value.match(/\d+(?:[.,]\d+)*/gu) ?? []);
const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM: las cortas excesivas conservan toda la información al redistribuirse", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const source = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    const originalGeneral = record.longDescription?.trim() ?? null;
    const balanced = rebalanceGamOverlongShort(record, resolveGamTecnacarGeneral(record) ?? originalGeneral);
    if (expected.has(record.reference ?? "")) {
      assert.ok(record.reference);
      changed.add(record.reference);
      assert.ok(prepared.product.description);
      assert.ok(prepared.product.description_general);
      assert.ok(words(prepared.product.description) <= 45);
      assert.ok(words(prepared.product.description) >= 10);
      const fullText = `${prepared.product.description} ${prepared.product.description_general}`;
      for (const number of numericTokens(record.shortDescription ?? "")) {
        assert.ok(numericTokens(fullText).has(number), `${record.reference}: ${number}`);
      }
      assert.ok(prepared.product.description_general.includes(originalGeneral ?? ""));
      assert.ok(balanced);
      assert.equal(prepared.product.description, balanced.short);
    }
    assert.equal(JSON.stringify(record), source);
  }
  assert.deepEqual(changed, expected);
});

test("GAM: una identidad ajena, una variante cruzada o un texto truncado no se sintetiza", () => {
  const sample = find("6218");
  const general = sample.longDescription;
  assert.ok(general);
  const rejected: readonly ProductRecord[] = [
    { ...sample, providerId: "gomariz" },
    { ...sample, reference: "6477" },
    { ...sample, url: sample.url.replace("online.gamrentals.com", "example.com") },
    { ...sample, url: `${sample.url}?ref=other` },
    { ...sample, model: "LX08" },
    { ...sample, brand: "Otra" },
    { ...sample, specs: { ...sample.specs, Modelo: "LX08" } },
    { ...sample, specs: { ...sample.specs, Marca: "Otra" } },
    { ...sample, title: "LVNENG LX08" },
    { ...sample, shortDescription: sample.shortDescription?.slice(0, 45) ?? null },
    { ...sample, longDescription: "Texto escaso." }
  ];
  for (const [index, variant] of rejected.entries()) {
    assert.equal(rebalanceGamOverlongShort(variant, variant.longDescription), null, String(index));
  }
  for (const reference of ["5949", "6806", "6807", "2159", "4778", "4039", "4029"]) {
    const record = find(reference);
    assert.equal(rebalanceGamOverlongShort(record, record.longDescription), null, reference);
  }
});

test("GAM: no interviene en fichas Gomariz", async () => {
  const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
  for (const record of gomariz.products) {
    assert.equal(rebalanceGamOverlongShort(record, record.longDescription), null);
  }
});

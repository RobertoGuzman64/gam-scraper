import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamAdditionalCondensedGeneral, resolveGamAdditionalCondensedShort } from "../mapping/providers/gam/verified-condensed-additional.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const expected = new Set([
  "1210", "1211", "1212", "1213", "1214", "6185", "6188", "6874", "6953", "6168",
  "4659", "4651", "6547", "6148", "2239", "5993", "6425", "6368", "6325", "2146"
]);

const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const wordCount = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;

test("aplica síntesis editorial contrastada únicamente a veinte fichas GAM", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const source = JSON.stringify(record);
    const general = resolveGamAdditionalCondensedGeneral(record);
    if (general !== null) {
      assert.ok(record.reference && record.model);
      changed.add(record.reference);
      assert.ok(general.includes(record.model) || record.reference === "6168", record.reference);
      assert.ok(wordCount(general) >= 70 && wordCount(general) < wordCount(record.longDescription ?? "") / 2);
      const prepared = prepareSourceProduct(record).product;
      assert.equal(prepared.description_general, general, record.reference);
      assert.equal(prepared.description, resolveGamAdditionalCondensedShort(record) ?? record.shortDescription?.trim(), record.reference);
      assert.equal(prepared.reference, record.reference);
      assert.equal(prepared.sourceUrl, record.url);
      for (const [key, value] of Object.entries(record.specs ?? {})) {
        assert.equal(prepared.spec[key], value, `${record.reference}: ${key}`);
      }
    }
    assert.equal(JSON.stringify(record), source, record.reference ?? "");
  }
  assert.deepEqual(changed, expected);
  for (const record of gomariz.products) {
    assert.equal(resolveGamAdditionalCondensedGeneral(record), null);
    assert.equal(resolveGamAdditionalCondensedShort(record), null);
  }
});

test("bloquea referencias cruzadas, variantes y textos de origen cambiados", () => {
  const original = find("6547");
  assert.match(resolveGamAdditionalCondensedShort(original) ?? "", /230 kg/u);
  const invalid: readonly ProductRecord[] = [
    { ...original, providerId: "gomariz" },
    { ...original, condition: "Segunda mano" },
    { ...original, reference: "4659" },
    { ...original, model: "TRACCESS 230" },
    { ...original, externalReference: "TRACCESS 230" },
    { ...original, title: "CTE TRACCESS 230" },
    { ...original, brand: "Otra" },
    { ...original, categoryKey: "manutencion" },
    { ...original, url: `${original.url}?variant=1` },
    { ...original, specs: { ...original.specs, "Capacidad de carga (kg)": "200 KG" } },
    { ...original, longDescription: `${original.longDescription ?? ""} Nueva versión.` }
  ];
  for (const [index, item] of invalid.entries()) {
    assert.equal(resolveGamAdditionalCondensedGeneral(item), null, String(index));
    assert.equal(resolveGamAdditionalCondensedShort(item), null, String(index));
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamFamilyTechnicalDescription } from "../mapping/providers/gam/family-technical-description.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const expected = new Set(["2323", "2163", "2164", "2165", "2169", "2105", "2153", "2106", "2154", "2107", "1136"]);

test("GAM: completa medidas documentadas en familias sin sustituir ni resumir la general original", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const snapshot = JSON.stringify(record);
    const result = resolveGamFamilyTechnicalDescription(record);
    if (result) {
      assert.ok(record.reference);
      changed.add(record.reference);
      assert.ok(record.longDescription);
      assert.ok(result.startsWith(`${record.longDescription.trim()}\n\n`));
      assert.equal(prepareSourceProduct(record).product.description_general, result);
      assert.deepEqual(prepareSourceProduct(record).product.spec, record.specs);
    }
    assert.equal(JSON.stringify(record), snapshot);
  }
  assert.equal(gam.products.length, 983);
  assert.deepEqual(changed, expected);
});

test("GAM: no amplía una identidad distinta, datos alterados ni una motorización contradictoria", () => {
  const record = find("2107");
  assert.ok(resolveGamFamilyTechnicalDescription(record));
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "2106" },
    { ...record, model: "S1.6" },
    { ...record, title: "Carretilla elevadora apiladora HYSTER S1.6" },
    { ...record, brand: "YALE" },
    { ...record, url: record.url.replace("online.gamrentals.com", "example.com") },
    { ...record, url: `${record.url}?tracking=1` },
    { ...record, shortDescription: "Texto sin modelo acreditado" },
    { ...record, longDescription: "Texto sin modelo acreditado" },
    { ...record, specs: { ...record.specs, Modelo: "S1.6" } },
    { ...record, specs: { ...record.specs, Marca: "YALE" } },
    { ...record, specs: { ...record.specs, Longitud: "N/D" } },
    { ...record, specs: { ...record.specs, Anchura: "24000 mm" } },
    { ...record, specs: { ...record.specs, Motorización: "Diésel" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveGamFamilyTechnicalDescription(variant), null, String(index));
  }
  for (const reference of ["2312", "2311", "922", "4040", "5996"]) {
    assert.equal(resolveGamFamilyTechnicalDescription(find(reference)), null, reference);
  }
});

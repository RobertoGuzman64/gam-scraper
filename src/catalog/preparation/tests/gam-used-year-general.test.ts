import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamUsedYearGeneral } from "../mapping/providers/gam/used-year-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const expected = new Set([
  "6617", "6623", "5254", "6218", "6477", "6635", "6636", "6262", "6478", "6479",
  "6813", "6811", "6807", "6802", "5918"
]);

const find = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM: año de fabricación propio ausente de ambos textos, sin alterar otros campos", () => {
  const recovered = new Set<string>();
  for (const record of gam.products) {
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    const previousGeneral = prepared.product.description_general;
    const extracted = previousGeneral?.match(/^Año de fabricación declarado para esta unidad: (\d{4})\.\n\n/u);
    if (extracted) {
      assert.ok(record.reference && record.year && previousGeneral && record.title);
      assert.equal(extracted[1], record.year, record.reference);
      assert.ok(expected.has(record.reference), record.reference);
      assert.equal(record.condition, "Segunda mano");
      assert.ok(record.yearSource === "ficha" || record.yearSource === "url");
      const underlying = previousGeneral.slice(extracted[0].length);
      assert.equal(resolveGamUsedYearGeneral(record, prepared.product.description, underlying), previousGeneral);
      assert.ok(!prepared.product.description?.includes(` ${record.year} `));
      recovered.add(record.reference);
    }
    assert.equal(JSON.stringify(record), original);
  }
  assert.deepEqual(recovered, expected);
});

test("GAM: rechaza identidad, año o fuente discrepantes sin enriquecer", () => {
  const base = find("6218");
  const prepared = prepareSourceProduct(base);
  const currentGeneral = prepared.product.description_general;
  assert.ok(currentGeneral);
  const previousGeneral = currentGeneral.replace(/^Año de fabricación declarado para esta unidad: 2022\.\n\n/u, "");
  const invalid: readonly ProductRecord[] = [
    { ...base, providerId: "gomariz" },
    { ...base, condition: "Nuevo" },
    { ...base, year: "2023" },
    { ...base, year: "not-a-year" },
    { ...base, yearSource: "descripcion" },
    { ...base, title: "LVNENG LX08" },
    { ...base, brand: "OTRA" },
    { ...base, model: "LX08" },
    { ...base, specs: { ...base.specs, "Año de fabricación": "2021" } },
    { ...base, url: `${base.url}?variant=2` },
    { ...base, url: base.url.replace("6218-", "9999-") },
    { ...base, url: base.url.replace("online.gamrentals.com", "example.org") },
    { ...base, longDescription: `${base.longDescription ?? ""} Fabricada en el año 2018.` }
  ];
  for (const [index, record] of invalid.entries()) {
    assert.equal(resolveGamUsedYearGeneral(record, prepared.product.description, previousGeneral), null, String(index));
  }
  assert.equal(resolveGamUsedYearGeneral(base, prepared.product.description, currentGeneral), null);
  assert.equal(resolveGamUsedYearGeneral(find("5855"), "Resumida", "Fabricada en el año 2022."), null);
  assert.equal(resolveGamUsedYearGeneral(find("6666"), "Resumida", "Sin año."), null);
  assert.equal(resolveGamUsedYearGeneral(find("6806"), "Resumida", "Sin año."), null);
});

test("Gomariz: no añade fechas en otra procedencia", () => {
  for (const record of gomariz.products) {
    const prepared = prepareSourceProduct(record);
    assert.equal(resolveGamUsedYearGeneral(record, prepared.product.description, prepared.product.description_general), null);
  }
});

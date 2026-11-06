import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamHandlingSourceEditorial } from "../../../../mapping/providers/gam/editorial-descriptions/handling-source-editorial.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGamSourceTechnicalUnits } from "../../../../reconciliation/gam-source-technical-units.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const references = new Set(["2369", "2260", "2335", "5988", "2287", "6323", "5888", "2318", "2319", "2320", "2139", "2242", "2244", "2137", "3140", "2238", "2240", "2273", "2274", "2248"]);

const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("publica descripciones técnicas de manutención sin cambiar especificaciones ni fuente", () => {
  for (const reference of references) {
    const record = find(reference);
    const before = JSON.stringify(record);
    const prepared = prepareSourceProduct(record).product;
    assert.ok(prepared.description_general, reference);
    assert.ok(prepared.description_general.length >= 200 && prepared.description_general.length < 650, reference);
    assert.ok(record.longDescription && prepared.description_general.length < record.longDescription.length / 2, reference);
    assert.ok(record.model && prepared.description_general.toLocaleLowerCase("es").includes(record.model.toLocaleLowerCase("es")), reference);
    assert.equal(JSON.stringify(record), before, reference);
    for (const [key, value] of Object.entries(reconcileGamSourceTechnicalUnits(record).specs ?? {})) {
      assert.equal(prepared.spec[key], value, `${reference}: ${key}`);
    }
  }
  assert.match(prepareSourceProduct(find("5988")).product.description ?? "", /3\.000 mm/);
  assert.match(prepareSourceProduct(find("6323")).product.description ?? "", /3\.990 mm/);
  assert.doesNotMatch(prepareSourceProduct(find("2244")).product.description_general ?? "", /Yale MP18:/);
  assert.doesNotMatch(prepareSourceProduct(find("2287")).product.description_general ?? "", /La Carretilla Elevadora Eléctrica Yale ERP20UXT/);
});

test("no traslada las ediciones a otros modelos, fuentes o estados del anuncio", () => {
  const record = find("5988");
  const prepared = prepareSourceProduct(record).product;
  const revisedGeneral = prepared.description_general;
  assert.ok(revisedGeneral);
  assert.equal(resolveGamHandlingSourceEditorial(record, prepared.description, revisedGeneral), null);
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "5888" },
    { ...record, url: `${record.url}?revision=otra` },
    { ...record, title: "Otro producto" },
    { ...record, model: "ERP3.0MXLG" },
    { ...record, brand: "OTRA" },
    { ...record, shortDescription: "Texto modificado" },
    { ...record, longDescription: "Texto modificado" },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "3000 KG" } }
  ];
  for (const variant of variants) {
    assert.notEqual(prepareSourceProduct(variant).product.description_general, revisedGeneral);
  }
  for (const other of gomariz.products) {
    assert.equal(resolveGamHandlingSourceEditorial(other, other.shortDescription, other.longDescription), null);
  }
});

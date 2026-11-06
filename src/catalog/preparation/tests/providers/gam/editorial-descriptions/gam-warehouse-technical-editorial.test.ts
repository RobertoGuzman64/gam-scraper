import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamWarehouseTechnicalEditorial } from "../../../../mapping/providers/gam/editorial-descriptions/warehouse-technical-editorial.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGamSourceTechnicalUnits } from "../../../../reconciliation/gam-source-technical-units.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const references = new Set([
  "5991", "5992", "2281", "2282", "2283", "2284", "3141", "3143", "3145", "3146",
  "3135", "3136", "2014", "3000", "2794", "2181", "2108", "2286", "2266", "2267"
]);

const find = (reference: string): ProductRecord => {
  const result = gam.products.find((product) => product.reference === reference);
  assert.ok(result, reference);
  return result;
};

test("publica las descripciones técnicas de 20 referencias sin mezclar modelos ni prestaciones", () => {
  let changed = 0;
  for (const record of gam.products) {
    if (!record.reference || !references.has(record.reference)) continue;
    const original = JSON.stringify(record);
    const product = prepareSourceProduct(record).product;
    assert.equal(product.reference, record.reference);
    assert.equal(product.sourceUrl, record.url);
    assert.ok(record.model && product.description_general, record.reference);
    assert.ok(product.description_general.toLocaleLowerCase("es").includes(record.model.toLocaleLowerCase("es")), record.reference);
    assert.ok(product.description_general.length >= 200 && product.description_general.length < 650, record.reference);
    assert.ok(record.longDescription && product.description_general.length < record.longDescription.length / 2, record.reference);
    assert.doesNotMatch(product.description_general, /experimente la excelencia|soluci[oó]n definitiva|m[aá]xima productividad/i, record.reference);
    assert.equal(JSON.stringify(record), original, record.reference);
    for (const [key, value] of Object.entries(reconcileGamSourceTechnicalUnits(record).specs ?? {})) {
      assert.equal(product.spec[key], value, `${record.reference}: ${key}`);
    }
    changed++;
  }
  assert.equal(changed, 20);
  assert.match(prepareSourceProduct(find("5991")).product.description ?? "", /3\.000 mm/);
  assert.match(prepareSourceProduct(find("5992")).product.description ?? "", /3\.000 mm/);
  assert.match(prepareSourceProduct(find("3136")).product.description_general ?? "", /peso registrado no se utiliza/);
  assert.match(prepareSourceProduct(find("2267")).product.description_general ?? "", /unidad incoherente/);
});

test("no reaplica la redacción si cambia la fuente, identidad o texto preparado", () => {
  const record = find("2281");
  assert.ok(record.longDescription);
  const result = resolveGamWarehouseTechnicalEditorial(record, record.shortDescription, record.longDescription);
  assert.ok(result);
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "2282" },
    { ...record, url: `${record.url}?otra-unidad=1` },
    { ...record, title: "Otra carretilla" },
    { ...record, model: "ERC50VH" },
    { ...record, brand: "OTRA" },
    { ...record, externalReference: "OTRA" },
    { ...record, categoryKey: "otra-categoria" },
    { ...record, shortDescription: "Otra descripción" },
    { ...record, longDescription: "Otra descripción" },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "5000 KG" } }
  ];
  for (const variant of variants) {
    assert.equal(resolveGamWarehouseTechnicalEditorial(variant, record.shortDescription, record.longDescription), null);
  }
  assert.equal(resolveGamWarehouseTechnicalEditorial(record, record.shortDescription, "Texto cambiado"), null);
  for (const other of gomariz.products) {
    assert.equal(resolveGamWarehouseTechnicalEditorial(other, other.shortDescription, other.longDescription), null);
  }
});

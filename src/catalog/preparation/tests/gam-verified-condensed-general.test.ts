import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamCondensedGeneral, resolveGamCondensedShort } from "../mapping/providers/gam/verified-condensed-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const targeted = new Set([
  "4991", "4988", "4990", "4989", "6308", "6954", "6573", "6574", "6767", "6114",
  "6744", "2370", "6768", "6115", "6743", "6873", "6113", "5995", "5996", "5997"
]);

const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const words = (text: string): number => text.split(/\s+/u).filter(Boolean).length;

test("GAM: sintetiza solo veinte descripciones acreditadas sin alterar el original ni las especificaciones", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const source = JSON.stringify(record);
    const general = resolveGamCondensedGeneral(record);
    if (general !== null) {
      assert.ok(record.reference);
      changed.add(record.reference);
      assert.ok(targeted.has(record.reference), record.reference);
      assert.ok(general.includes(record.model ?? ""), record.reference);
      assert.ok(words(general) >= 80 && words(general) <= 270, record.reference);
      assert.ok(words(general) < words(record.longDescription ?? "") / 2, record.reference);
      const prepared = prepareSourceProduct(record).product;
      assert.equal(prepared.description_general, general, record.reference);
      if (record.reference !== "6308" && record.reference !== "6574") {
        const numbers = new Set(`${prepared.description ?? ""} ${general}`.match(/\d+(?:[.,]\d+)*/gu) ?? []);
        for (const number of record.shortDescription?.match(/\d+(?:[.,]\d+)*/gu) ?? []) {
          assert.ok(numbers.has(number), `${record.reference}: ${number}`);
        }
      }
      for (const [key, value] of Object.entries(record.specs ?? {})) {
        assert.equal(prepared.spec[key], value, `${record.reference}: ${key}`);
      }
      assert.equal(prepared.reference, record.reference);
      assert.equal(prepared.sourceUrl, record.url);
    }
    assert.equal(JSON.stringify(record), source, record.reference ?? "");
  }
  assert.deepEqual(changed, targeted);
});

test("GAM: la edición no se aplica ante variantes, cambios de evidencia o referencias cruzadas", () => {
  const unit = find("6574");
  assert.match(resolveGamCondensedShort(unit) ?? "", /RO2\.0.*2\.000 kg/u);
  assert.equal(prepareSourceProduct(unit).product.description, resolveGamCondensedShort(unit));
  const rejected: readonly ProductRecord[] = [
    { ...unit, providerId: "gomariz" },
    { ...unit, reference: "6573" },
    { ...unit, url: unit.url.replace("gamrentals.com", "example.com") },
    { ...unit, url: `${unit.url}?variant=other` },
    { ...unit, title: "Carretilla Hyster RO1.6" },
    { ...unit, model: "RO1.6" },
    { ...unit, externalReference: "RO1.6" },
    { ...unit, specs: { ...unit.specs, "Capacidad de carga (kg)": "1600 KG" } },
    { ...unit, longDescription: `${unit.longDescription ?? ""} Nueva versión no contrastada.` }
  ];
  for (const [index, record] of rejected.entries()) {
    assert.equal(resolveGamCondensedGeneral(record), null, String(index));
    assert.equal(resolveGamCondensedShort(record), null, String(index));
  }
  for (const reference of ["5991", "5992", "6745", "6185", "BA1465"]) {
    const record = gam.products.find((entry) => entry.reference === reference);
    if (record) assert.equal(resolveGamCondensedGeneral(record), null, reference);
  }
});

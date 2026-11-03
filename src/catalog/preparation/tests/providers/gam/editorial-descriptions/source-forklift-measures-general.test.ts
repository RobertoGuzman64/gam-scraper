import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { includeGamSourceForkliftMeasuresInGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/source-forklift-measures-general.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera medidas de carretillas con unidad publicada sin modificar el original ni spec", () => {
  for (const [reference, expected] of [
    ["2079", /centro de carga declarado[^.]*500 mm/iu],
    ["2036", /radio de giro indicado[^.]*1\.981 mm/iu],
    ["2072", /centro de carga declarado[^.]*500 mm[^]*radio de giro indicado[^.]*2\.298 mm/iu]
  ] as const) {
    const record = find(reference);
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.match(prepared.product.description_general ?? "", expected, reference);
    assert.deepEqual(record, original, reference);
    assert.equal(prepared.product.spec["Centro de carga"], record.specs?.["Centro de carga"], reference);
    assert.equal(prepared.product.spec["Radio de giro"], record.specs?.["Radio de giro"], reference);
    assert.equal(includeGamSourceForkliftMeasuresInGeneral(record, prepared.product.description_general, prepared.product.spec),
      prepared.product.description_general, reference);
  }
});

test("rechaza variante, origen, unidades y valores sin acreditar y evita duplicados", () => {
  const record = find("2072");
  const general = "La Hyster S4.0FT es una carretilla elevadora para manipulación de cargas.";
  const specs = prepareSourceProduct(record).product.spec;
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "9999" },
    { ...record, model: "S5.0FT" },
    { ...record, specs: { ...record.specs, Modelo: "S5.0FT" } },
    { ...record, url: `${record.url}?variante=otra` },
    { ...record, categoryKey: "elevacion" },
    { ...record, condition: "Segunda mano" },
    { ...record, specs: { ...record.specs, "Centro de carga": "500", "Radio de giro": "2298" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(includeGamSourceForkliftMeasuresInGeneral(variant, general, specs), general, String(index));
  }
  const changed: SpecsMap = { ...specs, "Centro de carga": "600 mm", "Radio de giro": "2.298 mm" };
  assert.equal(includeGamSourceForkliftMeasuresInGeneral(record, general, changed), general);
  assert.equal(includeGamSourceForkliftMeasuresInGeneral(record, `${general} Centro de carga de 500 mm y radio de giro de 2.298 mm.`, specs),
    `${general} Centro de carga de 500 mm y radio de giro de 2.298 mm.`);
  assert.equal(includeGamSourceForkliftMeasuresInGeneral(record, null, specs), null);
});

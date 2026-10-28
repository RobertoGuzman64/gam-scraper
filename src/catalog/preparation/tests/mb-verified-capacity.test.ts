import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { verifiedMercaelevaMbCapacity } from "../mapping/providers/mercaeleva/verified-mb-capacity.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json");
const capacity = catalog.attributes.find((attribute) => attribute.name === "Capacidad de carga" && attribute.unit_option === "kg");
assert.ok(capacity);

const find = (reference: string): ProductRecord => {
  const record = source.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

for (const [reference, expected, original] of [
  ["M062-8951", 3000, "2500 kg"],
  ["M119-9334", 1800, "1500 kg"]
] as const) {
  test(`Mercaeleva: ${reference} reconoce capacidad MB confirmada y preserva la ficha original`, () => {
    const record = find(reference);
    const before = JSON.stringify(record);
    assert.equal(verifiedMercaelevaMbCapacity(record), expected);
    assert.deepEqual(resolveAttribute(record, capacity), { status: "resolved", value: expected });
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.status, "ready");
    assert.deepEqual(prepared.issues, []);
    const loadAttributes = prepared.product.attributes.filter((item) =>
      catalog.attributes.some((definition) => definition.id === item.attributeID &&
        definition.name === "Capacidad de carga"));
    assert.deepEqual(loadAttributes.map((item) => item.value), [expected]);
    assert.equal(prepared.product.spec["Capacidad máxima de elevación"], original);
    assert.deepEqual(prepared.product.spec, record.specs);
    assert.equal(JSON.stringify(record), before);
  });

  test(`Mercaeleva: ${reference} no acepta falsos positivos de identidad, estado, batería o ficha`, () => {
    const record = find(reference);
    const changed: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, categoryKey: "otros" },
      { ...record, condition: "Segunda mano" },
      { ...record, year: "2024" },
      { ...record, reference: "OTRA" },
      { ...record, url: record.url.replace("sales.mercaeleva.com", "fake.example") },
      { ...record, url: `${record.url}-otro` },
      { ...record, brand: "EP" },
      { ...record, model: `${record.model}S` },
      { ...record, title: `${record.title} 2500 kg` },
      { ...record, shortDescription: "Capacidad alternativa 2500 kg" },
      { ...record, longDescription: "Capacidad de carga de 2500 kg" },
      { ...record, specs: { ...record.specs, Marca: "EP" } },
      { ...record, specs: { ...record.specs, Modelo: "EFL253" } },
      { ...record, specs: { ...record.specs, Estado: "Usado" } },
      { ...record, specs: { ...record.specs, "Tipo de Batería": "Plomo-ácido" } },
      { ...record, specs: { ...record.specs, "Título adicional": "Máquina sin capacidad" } },
      { ...record, specs: { ...record.specs, "Capacidad máxima de elevación": "3000 kg" } },
      { ...record, specs: { ...record.specs, "Capacidad máxima de elevación": ["1500 kg", "1800 kg"] } },
      { ...record, specs: { ...record.specs, "Voltaje de la batería": "24 V" } },
      { ...record, specs: { ...record.specs, "Capacidad de la batería": "150 Ah" } }
    ];
    for (const [index, variant] of changed.entries()) {
      assert.equal(verifiedMercaelevaMbCapacity(variant), null, String(index));
    }
  });
}

test("la capacidad MB no se infiere para otras referencias Mercaeleva", () => {
  const corrected = new Set(["M062-8951", "M119-9334"]);
  for (const record of source.products) {
    if (corrected.has(record.reference ?? "")) continue;
    assert.equal(verifiedMercaelevaMbCapacity(record), null, record.reference ?? "sin referencia");
  }
});

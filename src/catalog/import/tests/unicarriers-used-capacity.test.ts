import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { reconcileMercaelevaVerifiedUnicarriersCapacity } from "../mapping/providers/mercaeleva/unicarriers-used-capacity-evidence.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const source = await readCanonicalCatalog("src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json");
const catalog = await loadImportCatalog();
const record = source.products.find((item) => item.reference === "M582-1882");
assert.ok(record);

test("capacidad de unidad UniCarriers documentada y original intacto", () => {
  const original = structuredClone(record);
  const preparedRecord = reconcileMercaelevaVerifiedUnicarriersCapacity(record);
  assert.notStrictEqual(preparedRecord, record);
  assert.equal(preparedRecord.title, "UniCarriers E2D2A30 CARRETILLA ELEVADORA DIESEL 2500 KG");
  assert.equal(preparedRecord.specs?.["Título adicional"], "CARRETILLA ELEVADORA DIESEL 2500 KG");
  assert.equal(preparedRecord.specs?.["Capacidad máxima de elevación"], "2500 kg");
  assert.match(preparedRecord.longDescription ?? "", /2500 KG UNICARRIERS E2D2A30 HORAS 8142/);
  assert.strictEqual(reconcileMercaelevaVerifiedUnicarriersCapacity(preparedRecord), preparedRecord);
  const result = prepareProduct(record, catalog);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.issues, []);
  assert.equal(result.product.title, preparedRecord.title);
  assert.equal(result.product.description_general, preparedRecord.longDescription);
  assert.deepEqual(result.product.spec, original.specs);
  assert.deepEqual(record, original);
});

test("no reconcilia cambios de identidad, descripción o ficha técnica", () => {
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, reference: "M582-1883" },
    { ...record, url: `${record.url}?copied=1` },
    { ...record, categoryKey: "otros" },
    { ...record, condition: "Nuevo" },
    { ...record, brand: "Nissan" },
    { ...record, model: "E2D2A35" },
    { ...record, year: "2020" },
    { ...record, serialNumber: "SERIE-DISTINTA" },
    { ...record, horometer: "9000" },
    { ...record, title: record.title?.replace("3000", "2500") ?? null },
    { ...record, shortDescription: "Distinta descripción" },
    { ...record, longDescription: `${record.longDescription} otra ficha` },
    { ...record, specs: { ...record.specs, "Título adicional": "CARRETILLA ELEVADORA DIESEL 2500 KG" } },
    { ...record, specs: { ...record.specs, "Capacidad máxima de elevación": "3000 kg" } },
    { ...record, specs: { ...record.specs, "Artículo No.": "MER0000" } },
    { ...record, specs: { ...record.specs, "Tipo de mástil": "Dúplex" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.strictEqual(reconcileMercaelevaVerifiedUnicarriersCapacity(variant), variant, String(index));
  }
});

test("el corrector Unicarriers no altera otras fichas Mercaeleva", () => {
  for (const item of source.products) {
    if (item.reference === "M582-1882") continue;
    assert.strictEqual(reconcileMercaelevaVerifiedUnicarriersCapacity(item), item, item.reference ?? "");
  }
});

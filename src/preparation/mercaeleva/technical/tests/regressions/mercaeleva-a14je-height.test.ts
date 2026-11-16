import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { prepareProduct } from "../../../../../commercial/legacy-export/prepare-product.js";
import { loadImportCatalog } from "../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { accreditedSourceRecord } from "../../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileMercaelevaVerifiedA14jeHeight } from "../../evidence/verified-a14je-height.js";

const source = (): ProductRecord => accreditedSourceRecord("mercaeleva-original", "M887-9469");
const catalog = await loadImportCatalog();

test("A14JE conserva los 15,8 metros corroborados por fabricante en todos sus campos", () => {
  const record = source();
  const snapshot = JSON.stringify(record);
  const corrected = reconcileMercaelevaVerifiedA14jeHeight(record);
  assert.notStrictEqual(corrected, record);
  assert.strictEqual(reconcileMercaelevaVerifiedA14jeHeight(corrected), corrected);
  assert.equal(corrected.specs?.["Altura de trabajo"], "15,8 m");
  assert.match(corrected.title ?? "", /15,8 MT/u);
  assert.match(corrected.longDescription ?? "", /ALTURA DE TRABAJO 15,8 MT/u);
  for (const prepared of [prepareSourceProduct(record), prepareProduct(record, catalog)]) {
    assert.equal(prepared.status, "ready");
    assert.deepEqual(prepared.issues, []);
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.match(prepared.product.title ?? "", /15,8 m/u);
    assert.match(prepared.product.description_general ?? "", /15,8 m/u);
    assert.equal(prepared.product.spec["Altura de trabajo"], "15,8 m");
    assert.equal(prepared.product.spec["Altura de plataforma"], "13,8 m");
  }
  assert.equal(JSON.stringify(record), snapshot);
});

test("la altura documentada no se aplica a otra fuente, variante, año, horario o titular", () => {
  const record = source();
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, reference: "M887-9470" },
    { ...record, url: `${record.url}?revision=1` },
    { ...record, brand: "OTRA" },
    { ...record, model: "A14J" },
    { ...record, year: "2024" },
    { ...record, horometer: "299" },
    { ...record, price: "32000" },
    { ...record, condition: "Nuevo" },
    { ...record, categoryKey: "otras" },
    { ...record, title: `${record.title} edición nueva` },
    { ...record, longDescription: `${record.longDescription} edición nueva` },
    { ...record, specs: { ...record.specs, "Altura de trabajo": "17 m" } },
    { ...record, specs: { ...record.specs, "Título adicional": "OTRO MODELO" } }
  ];
  for (const variant of variants) {
    assert.strictEqual(reconcileMercaelevaVerifiedA14jeHeight(variant), variant);
  }
});

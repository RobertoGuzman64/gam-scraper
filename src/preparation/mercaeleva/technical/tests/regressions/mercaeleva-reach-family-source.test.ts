import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { prepareProduct } from "../../../../../commercial/legacy-export/prepare-product.js";
import { loadImportCatalog } from "../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { accreditedSourceRecord } from "../../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { sourceSemanticQualityIssues } from "../../../../shared/quality/source/semantic-quality.js";
import { resolveKnowledgeEditorial } from "../../../../shared/editorial/mapping/knowledge-editorial.js";
import { reconcileMercaelevaVerifiedReachTruckFamily } from "../../reconciliation/mercaeleva.js";

const source = (): ProductRecord => accreditedSourceRecord("mercaeleva-original", "M547-2372");
const catalog = await loadImportCatalog();

test("M547-2372 rectifica el texto de familia manteniendo su firma y prestaciones documentadas", () => {
  const record = source();
  const snapshot = JSON.stringify(record);
  const corrected = reconcileMercaelevaVerifiedReachTruckFamily(record);
  const signed = resolveKnowledgeEditorial(record, record);
  assert.notStrictEqual(corrected, record);
  assert.strictEqual(reconcileMercaelevaVerifiedReachTruckFamily(corrected), corrected);
  assert.ok(sourceSemanticQualityIssues(record).some((issue) => issue.startsWith("Familia contradictoria")));
  assert.deepEqual(sourceSemanticQualityIssues(corrected), []);
  for (const prepared of [prepareSourceProduct(record), prepareProduct(record, catalog)]) {
    assert.equal(prepared.status, "ready");
    assert.deepEqual(prepared.issues, []);
    assert.equal(prepared.product.description, signed.short);
    assert.match(prepared.product.description_general ?? "", /CARRETILLA RETRACTIL ELECTRICA/u);
    assert.doesNotMatch(prepared.product.description_general ?? "", /TRANSPALET/u);
    assert.equal(prepared.product.spec["Artículo No."], "MER1123");
    assert.equal(prepared.product.spec["Capacidad nominal según texto comercial"], "1.350 kg");
    assert.equal(prepared.product.spec.Propulsión, "Eléctrica");
    assert.equal(prepared.product.spec["Centro de carga nominal del modelo"], "600 mm");
    assert.equal(prepared.product.spec["Anchura exterior del modelo"], "1250 mm");
    assert.equal(prepared.product.spec["Radio de giro exterior del modelo"], "1570 mm");
  }
  assert.equal(JSON.stringify(record), snapshot);
});

test("la conciliación retráctil no se transmite a otra variante, fuente o referencia", () => {
  const record = source();
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, reference: "M547-2373" },
    { ...record, url: `${record.url}?otra-version=true` },
    { ...record, brand: "LINDE" },
    { ...record, model: "6FBRE15" },
    { ...record, title: `${record.title} otra versión` },
    { ...record, specs: { ...record.specs, Modelo: "6FBRE15" } },
    { ...record, specs: { ...record.specs, "Título adicional": "TRANSPALET ELECTRICO 1350 KG" } },
    { ...record, specs: { ...record.specs, "Artículo No.": "MER1124" } },
    { ...record, longDescription: `${record.longDescription} otro origen` }
  ];
  for (const variant of variants) {
    assert.strictEqual(reconcileMercaelevaVerifiedReachTruckFamily(variant), variant);
    assert.equal(JSON.stringify(variant).includes("CARRETILLA RETRACTIL ELECTRICA"), false);
  }
});

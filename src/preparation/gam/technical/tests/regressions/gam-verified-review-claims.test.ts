import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { prepareProduct } from "../../../../../commercial/legacy-export/prepare-product.js";
import { loadImportCatalog } from "../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { accreditedSourceSamples } from "../../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { resolveKnowledgeEditorial } from "../../../../shared/editorial/mapping/knowledge-editorial.js";
import { reconcileGamVerifiedReviewClaims } from "../../models/gam-verified-review-claims.js";

const references = ["6909", "2211", "2071", "241"] as const;
const source = (reference: string): ProductRecord => {
  const record = [...accreditedSourceSamples("gam-original"), ...accreditedSourceSamples("gam-source-cases")]
    .find((item) => item.reference === reference);
  if (!record) throw new Error(`Evidencia original ausente: ${reference}`);
  return record;
};
const catalog = await loadImportCatalog();

test("cuatro reviews GAM solo se recuperan con evidencia exacta y sin modificar originales", () => {
  for (const reference of references) {
    const record = source(reference);
    const snapshot = JSON.stringify(record);
    const corrected = reconcileGamVerifiedReviewClaims(record);
    assert.notStrictEqual(corrected, record, reference);
    assert.strictEqual(reconcileGamVerifiedReviewClaims(corrected), corrected, reference);
    assert.equal(corrected.reference, record.reference, reference);
    assert.equal(corrected.url, record.url, reference);
    assert.equal(corrected.brand, record.brand, reference);
    assert.equal(corrected.model, record.model, reference);
    for (const prepared of [prepareSourceProduct(record), prepareProduct(record, catalog)]) {
      assert.equal(prepared.status, "ready", `${reference}: ${prepared.issues.join("; ")}`);
      assert.deepEqual(prepared.issues, [], reference);
      assert.equal(prepared.product.reference, record.reference, reference);
      assert.equal(prepared.product.sourceUrl, record.url, reference);
      assert.ok(prepared.product.description, reference);
      assert.ok(prepared.product.description_general, reference);
    }
    assert.equal(JSON.stringify(record), snapshot, reference);
  }
});

test("6909 conserva año 2008, advertencia firmada de capacidad y modelo completo", () => {
  const record = source("6909");
  const corrected = reconcileGamVerifiedReviewClaims(record);
  const prepared = prepareSourceProduct(record);
  const signed = resolveKnowledgeEditorial(record, record);
  assert.equal(record.year, "2007");
  assert.equal(corrected.year, "2008");
  assert.match(corrected.title ?? "", /SJIII-3220M/u);
  assert.match(corrected.shortDescription ?? "", /Año 2008/u);
  assert.match(prepared.product.title ?? "", /SJIII-3220M/u);
  assert.match(prepared.product.description ?? "", /2008/u);
  assert.equal(prepared.product.description_general, signed.general);
  assert.match(prepared.product.description_general ?? "", /363 y 400 kg/u);
  assert.deepEqual(prepared.product.spec, prepareSourceProduct({ ...record,
    title: `${record.title} variante sin acreditar` }).product.spec);
});

test("241 no convierte 2.000 kg en año y mantiene las prestaciones documentadas", () => {
  const record = source("241");
  const corrected = reconcileGamVerifiedReviewClaims(record);
  const prepared = prepareSourceProduct(record);
  assert.equal(record.year, "2000");
  assert.equal(record.yearSource, "titulo");
  assert.equal(corrected.year, null);
  assert.equal(corrected.yearSource, null);
  assert.match(prepared.product.description ?? "", /2\.000 kg/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /año de fabricación 2000/u);
  assert.equal(prepared.product.spec.Chasis, "Resistente a ácidos");
  assert.equal(prepared.product.spec["Timón y grupo de elevación"], "Acero inoxidable");
  assert.equal(prepared.product.spec["Acabado de bomba"], "Cromado");
});

test("2071 conserva motorización diésel y 2211 armoniza 16.400 kg sin sobrescribir más prestaciones", () => {
  const hyster = prepareSourceProduct(source("2071"));
  const yale = prepareSourceProduct(source("2211"));
  assert.equal(hyster.product.spec["Tipo motor"], "Mercedes-Benz OM934 Diésel");
  assert.equal(hyster.product.spec.Motorización, "Diésel");
  assert.equal(hyster.product.spec["Capacidad de carga (kg)"], "18200 KG");
  assert.match(hyster.product.description_general ?? "", /Mercedes-Benz OM934/u);
  assert.equal(yale.product.spec["Capacidad de carga (kg)"], "16400 KG");
  assert.match(yale.product.title ?? "", /16400 kg/u);
  assert.match(yale.product.description_general ?? "", /16400 kg/u);
  assert.doesNotMatch(yale.product.description_general ?? "", /16000 kg/u);
});

test("GAM no transfiere la corrección a otro proveedor, edición, modelo, serie o ficha", () => {
  for (const reference of references) {
    const record = source(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: `${reference}-OTRO` },
      { ...record, url: `${record.url}?variante=2` },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO" },
      { ...record, categoryKey: "otra-categoria" },
      { ...record, condition: record.condition === "Nuevo" ? "Segunda mano" : "Nuevo" },
      { ...record, title: `${record.title} nueva edición` },
      { ...record, shortDescription: `${record.shortDescription} dato nuevo` },
      { ...record, longDescription: `${record.longDescription} nueva edición` },
      { ...record, specs: { ...record.specs, Modelo: "OTRO" } },
      { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "9999 KG" } }
    ];
    for (const variant of variants) {
      assert.strictEqual(reconcileGamVerifiedReviewClaims(variant), variant, `${reference}: ${variant.url}`);
    }
  }
  const skyjack = source("6909");
  for (const altered of [
    { ...skyjack, year: "2009" },
    { ...skyjack, yearSource: "ficha" as const },
    { ...skyjack, serialNumber: "M600151" },
    { ...skyjack, externalReference: "OTRO-STOCK" }
  ]) {
    assert.strictEqual(reconcileGamVerifiedReviewClaims(altered), altered);
  }
  for (const altered of [
    { ...skyjack, yearSource: "ficha" as const },
    { ...skyjack, serialNumber: "M600151" }
  ]) {
    assert.equal(prepareSourceProduct(altered).status, "review");
  }
  const logitrans = source("241");
  for (const altered of [{ ...logitrans, year: "2010" }, { ...logitrans, yearSource: "ficha" as const }]) {
    assert.strictEqual(reconcileGamVerifiedReviewClaims(altered), altered);
    assert.equal(prepareSourceProduct(altered).status, "review");
  }
});

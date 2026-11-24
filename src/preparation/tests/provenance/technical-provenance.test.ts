import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { isProductTechnicalProvenance } from "../../provenance/technical-provenance.js";
import { buildPublicationTechnicalProvenance, isPublicationTechnicalProvenance } from "../../provenance/publication-technical-provenance.js";
import { originalRecordFingerprint } from "../../../catalog/identity-fingerprint.js";
import type { OfflinePreparation } from "../../documents/offline-document.js";

const record = (reference = "77777", longDescription = "La altura de trabajo: 12 m."): ProductRecord => ({
  providerId: "gam", categoryKey: "elevacion-nueva", categoryName: "Plataformas elevadoras nuevas",
  url: `https://online.gamrentals.com/es/plataformas-elevadoras-nuevas/${reference}-prueba`,
  reference, title: "Plataforma de tijera eléctrica XCMG", shortDescription: "Equipo de elevación",
  longDescription, price: "20000 €", brand: "XCMG", model: "Tijera", year: null,
  location: null, country: null, horometer: null, serialNumber: null, condition: "Nuevo",
  image: "https://example.test/image.jpg", images: ["https://example.test/image.jpg"], specs: {}
});

test("fase 17: el motor emite el mecanismo ejecutado con identidad de ficha y valor publicado", () => {
  const original = record();
  const prepared = prepareSourceProduct(original);
  assert.equal(prepared.product.spec["Altura de trabajo (m)"], "12 m");
  assert.ok(prepared.technicalProvenance);
  assert.ok(isProductTechnicalProvenance(prepared.technicalProvenance));
  assert.equal(prepared.technicalProvenance.originalRecordSha256, originalRecordFingerprint(original));
  assert.deepEqual(prepared.technicalProvenance.entries, [{
    field: "Altura de trabajo (m)", value: "12 m",
    mechanism: "src/preparation/gam/technical/measurements/work-height-evidence.ts",
    scope: "unit", sourceField: "longDescription", sourceValue: original.longDescription
  }]);
  const repeated = prepareSourceProduct(original);
  assert.deepEqual(repeated.technicalProvenance, prepared.technicalProvenance);
  assert.deepEqual(repeated.product, prepared.product);
});

test("fase 17: las variantes, fuentes y valores alterados invalidan la procedencia individual", () => {
  const initial = prepareSourceProduct(record());
  const changedValue = prepareSourceProduct(record("77777", "La altura de trabajo: 13 m."));
  const changedVariant = prepareSourceProduct(record("88888"));
  assert.notEqual(changedValue.technicalProvenance?.originalRecordSha256, initial.technicalProvenance?.originalRecordSha256);
  assert.notEqual(changedVariant.technicalProvenance?.originalRecordSha256, initial.technicalProvenance?.originalRecordSha256);
  assert.notDeepEqual(changedValue.technicalProvenance?.entries, initial.technicalProvenance?.entries);
  assert.deepEqual(prepareSourceProduct(record("77777", "Sin medidas de altura.")).technicalProvenance?.entries, []);
  assert.equal(prepareSourceProduct({ ...record(), url: "https://example.test/prueba" })
    .technicalProvenance?.entries[0]?.scope, "unknown");
});

test("fase 17: solo se publica procedencia técnica asociada a los productos aprobados", () => {
  const source = record();
  const first = prepareSourceProduct(source);
  const second = prepareSourceProduct(record("88888", "Sin medidas de altura."));
  const preparation: OfflinePreparation = {
    version: 1, quality: "complete", published: true, preparedAt: "2026-11-21T00:00:00.000Z",
    source: { providerId: "gam", prefix: "test", scope: "0000000000000000", catalogSha256: "a".repeat(64), productCount: 2 },
    fingerprints: { rulesVersion: 2, rulesSha256: "b".repeat(64) },
    totals: { ready: 2, review: 0 }, identities: ["gam:ref:77777", "gam:ref:88888"],
    products: [first, second]
  };
  const sha = "c".repeat(64);
  const trace = buildPublicationTechnicalProvenance("gam", sha, [first.product, second.product], preparation);
  assert.ok(trace);
  assert.ok(isPublicationTechnicalProvenance(trace));
  assert.equal(trace.products.length, 2);
  assert.equal(trace.products[0]?.technicalProvenance.entries.length, 1);
  assert.equal(trace.products[1]?.technicalProvenance.entries.length, 0);
  const empty = buildPublicationTechnicalProvenance("gam", sha, [second.product], preparation);
  assert.ok(empty);
  assert.equal(empty.products[0]?.technicalProvenance.entries.length, 0);
  assert.throws(() => buildPublicationTechnicalProvenance("gam", sha, [
    { ...first.product, reference: "99999" }
  ], preparation), /Falta producto preparado|Falta procedencia/);
  assert.equal(isPublicationTechnicalProvenance({ ...trace, products: [trace.products[0], trace.products[0]] }), false);
});

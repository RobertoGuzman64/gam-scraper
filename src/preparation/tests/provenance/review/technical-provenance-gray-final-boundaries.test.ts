import assert from "node:assert/strict";
import { test } from "node:test";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";

const withdrawn = [
  { providerId: "gam", reference: "6994", field: "Yale MP16 · Ancho exterior de horquillas", value: "680 mm",
    retained: "Yale MP16 · Accionamiento" },
  { providerId: "mercaeleva", reference: "M690-5522", field: "Anchura de plataforma", value: "1,42 m",
    retained: "Longitud de plataforma" },
  { providerId: "mercaeleva", reference: "M879-4639", field: "Centro de carga", value: "600 mm",
    retained: "Tensión del sistema de batería" }
] as const;

for (const item of withdrawn) {
  test(`retirada por insuficiencia de evidencia: ${item.providerId}:${item.reference}`, async () => {
    const catalog = await readPortableOriginal(process.cwd(), item.providerId);
    const original = catalog.products.find((record) => record.reference === item.reference);
    assert.ok(original);
    assert.ok(!Object.hasOwn(original.specs ?? {}, item.field));
    const before = JSON.stringify(original);
    const first = prepareSourceProduct(original);
    const second = prepareSourceProduct(original);
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(original), before);
    assert.equal(first.product.spec[item.field], undefined);
    assert.ok(first.product.spec[item.retained]);
    const trace = first.technicalProvenance;
    assert.ok(trace);
    assert.equal(trace.originalRecordSha256, originalRecordFingerprint(original));
    assert.ok(!trace.entries.some((entry) => entry.field === item.field && entry.value === item.value));
    assert.equal(classifyPublishedTechnicalSpec(original, trace, item.field, item.value), "pending");
  });
}

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readMercaelevaSource } from "../../../../testing/builders/mercaeleva-source-fixture.js";
import { verifiedPlatformModelDimensions } from "../../technical/evidence/verified-platform-model-dimensions.js";
import { resolveMercaelevaDocumentedModelDimensionsGeneral } from "../mapping/documented-model-dimensions-general.js";
import { recoverMercaelevaDocumentedPlatformTechnicalSpecs } from "../../technical/evidence/documented-platform-technical-specs.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const records = await readMercaelevaSource();
const expectedReferences = new Set([
  "M000-3684", "M008-1528", "M563-8693",
  "M037-5798", "M236-6155", "M835-4459",
  "M106-2983", "M510-3631", "M879-0952",
  "M028-0455", "M594-9948", "M621-1566",
  "M026-2648", "M904-5325",
  "M004-3667", "M845-8651",
  "M203-6152", "M439-8484",
  "M544-7437", "M659-0840"
]);

const find = (reference: string): ProductRecord => {
  const record = records.find((source) => source.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Mercaeleva: mejora veinte plataformas coherentes de ocho modelos documentados", () => {
  const matched = records.filter((record) => resolveMercaelevaDocumentedModelDimensionsGeneral(record));
  assert.equal(matched.length, 20);
  assert.deepEqual(new Set(matched.map((record) => record.reference)), expectedReferences);
  assert.deepEqual(new Set(matched.map((record) => `${record.brand} ${record.model}`)),
    new Set(verifiedPlatformModelDimensions.map((model) => `${model.brand} ${model.model}`)));

  for (const documentation of verifiedPlatformModelDimensions) {
    assert.match(documentation.source, /^https:\/\//);
  }

  for (const record of matched) {
    const original = JSON.stringify(record);
    const documentation = verifiedPlatformModelDimensions.find((model) =>
      record.brand === model.brand && record.model === model.model);
    assert.ok(documentation);
    const description = resolveMercaelevaDocumentedModelDimensionsGeneral(record);
    assert.ok(description);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.description_general, description);
    assert.ok(description.split(/\s+/u).length >= 60);
    for (const value of [documentation.manufacturerWorkHeight, documentation.platformHeight,
      documentation.nominalCapacity, documentation.additionalDimension, String(record.specs?.["Artículo No."]),
      record.year ?? ""]) {
      assert.ok(description.includes(value), `${record.reference}: ${value}`);
    }
    if (record.horometer) assert.ok(description.includes(`${record.horometer} h`));
    else assert.doesNotMatch(description, /\d+ h declaradas/u);
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.deepEqual(prepared.product.spec, recoverMercaelevaDocumentedPlatformTechnicalSpecs(record, record.specs ?? {}));
    assert.equal(JSON.stringify(record), original);
  }
});

test("Mercaeleva: rechaza cambios de identidad, horas, fuente y estado técnico", () => {
  for (const reference of ["M030-7485", "M342-3553", "M110-1645", "M620-2142"]) {
    assert.equal(resolveMercaelevaDocumentedModelDimensionsGeneral(find(reference)), null, reference);
  }
  for (const reference of expectedReferences) {
    const record = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, reference: `${reference}-otro` },
      { ...record, url: `${record.url}?otra-ficha` },
      { ...record, brand: "Otra marca" },
      { ...record, model: "Otro modelo" },
      { ...record, year: "2026" },
      { ...record, horometer: "99999" },
      { ...record, longDescription: `${record.longDescription} dato sin acreditar` },
      { ...record, specs: { ...record.specs, "Estado": "Nuevo" } },
      { ...record, specs: { ...record.specs, "Condición general": "Desconocido" } },
      { ...record, specs: { ...record.specs, "Tipo de motor": "Otro" } },
      { ...record, specs: { ...record.specs, "Altura de trabajo": "20 m" } },
      { ...record, specs: { ...record.specs, "Año de fabricación": "2026" } },
      { ...record, specs: { ...record.specs, "Horas laborales": "99999 h" } },
      { ...record, specs: { ...record.specs, "Artículo No.": "otro" } }
    ];
    for (const [index, variant] of variants.entries()) {
      assert.equal(resolveMercaelevaDocumentedModelDimensionsGeneral(variant), null, `${reference}:${index}`);
    }
  }
});

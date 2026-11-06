import { recoverMercaelevaDocumentedPlatformTechnicalSpecs } from "../../technical/evidence/documented-platform-technical-specs.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readMercaelevaSource } from "../../../../testing/builders/mercaeleva-source-fixture.js";
import { verifiedAdditionalPlatformModelDocumentation } from "../../technical/evidence/additional-platform-model-documentation.js";
import { resolveMercaelevaDocumentedAdditionalPlatformGeneral } from "../mapping/documented-additional-platform-general.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const records = await readMercaelevaSource();
const expectedReferences = new Set([
  "M998-5889", "M050-6081", "M081-0775", "M571-2568", "M976-1043",
  "M272-6304", "M243-5988", "M380-3644", "M922-8615", "M091-9536",
  "M369-6811", "M574-8807", "M299-2045",
  "M598-6695", "M107-1791", "M811-9996",
  "M057-0589", "M186-5711", "M416-1048",
  "M687-7610", "M517-8202"
]);

const find = (reference: string): ProductRecord => {
  const record = records.find((source) => source.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Mercaeleva: documenta exactamente veintiuna unidades de cinco modelos contrastados", () => {
  const matched = records.filter((record) => resolveMercaelevaDocumentedAdditionalPlatformGeneral(record));
  assert.equal(matched.length, 21);
  assert.deepEqual(new Set(matched.map((record) => record.reference)), expectedReferences);
  assert.deepEqual(new Set(matched.map((record) => `${record.brand} ${record.model}`)),
    new Set(verifiedAdditionalPlatformModelDocumentation.map((model) => `${model.brand} ${model.model}`)));

  for (const documentation of verifiedAdditionalPlatformModelDocumentation) {
    assert.match(documentation.source, /^https:\/\//);
  }

  for (const record of matched) {
    const original = JSON.stringify(record);
    const documentation = verifiedAdditionalPlatformModelDocumentation.find((model) =>
      model.brand === record.brand && model.model === record.model);
    assert.ok(documentation);
    const description = resolveMercaelevaDocumentedAdditionalPlatformGeneral(record);
    assert.ok(description);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.description_general, description);
    assert.ok(description.split(/\s+/u).length >= 60);
    assert.ok(description.includes(documentation.platformHeight));
    assert.ok(description.includes(documentation.nominalCapacity));
    assert.ok(description.includes(documentation.manufacturerWorkHeight));
    assert.ok(description.includes(String(record.specs?.["Artículo No."])));
    assert.ok(description.includes(record.year ?? "año no informado"));
    if (record.horometer) assert.ok(description.includes(`${record.horometer} h`));
    else assert.doesNotMatch(description, /\d+ h consignadas/u);
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.deepEqual(prepared.product.spec, recoverMercaelevaDocumentedPlatformTechnicalSpecs(record, record.specs ?? {}));
    assert.equal(JSON.stringify(record), original);
  }
});

test("Mercaeleva: preserva variantes, contradicciones y unidades con evidencia individual previa", () => {
  for (const reference of ["M620-2142", "M131-5855", "M281-3486", "M229-0241", "M539-6438"]) {
    assert.equal(resolveMercaelevaDocumentedAdditionalPlatformGeneral(find(reference)), null, reference);
  }

  for (const reference of expectedReferences) {
    const record = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, reference: `${reference}-variante` },
      { ...record, url: `${record.url}?variante=1` },
      { ...record, brand: "Otra marca" },
      { ...record, model: "Otro modelo" },
      { ...record, year: "2026" },
      { ...record, horometer: "99999" },
      { ...record, longDescription: `${record.longDescription} contenido no acreditado` },
      { ...record, specs: { ...record.specs, "Estado": "Nuevo" } },
      { ...record, specs: { ...record.specs, "Condición general": "Desconocida" } },
      { ...record, specs: { ...record.specs, "Tipo de motor": "Otro" } },
      { ...record, specs: { ...record.specs, "Altura de trabajo": "22 m" } },
      { ...record, specs: { ...record.specs, "Artículo No.": "otra" } },
      { ...record, specs: { ...record.specs, "Año de fabricación": "2026" } },
      { ...record, specs: { ...record.specs, "Horas laborales": "99999 h" } }
    ];
    for (const [index, variant] of variants.entries()) {
      assert.equal(resolveMercaelevaDocumentedAdditionalPlatformGeneral(variant), null, `${reference}:${index}`);
    }
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readMercaelevaSource } from "../../../../../../testing/builders/mercaeleva-source-fixture.js";
import { verifiedFurtherPlatformModelDocumentation } from "../../../../evidence/providers/mercaeleva/further-platform-model-documentation.js";
import { resolveMercaelevaDocumentedFurtherPlatformGeneral } from "../../../../mapping/providers/mercaeleva/documented-further-platform-general.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const records = await readMercaelevaSource();
const expectedReferences = new Set([
  "M417-2082", "M309-0364", "M040-2258", "M131-5855", "M317-3748",
  "M281-3486", "M229-0241", "M539-6438", "M579-7579", "M256-1875",
  "M045-6952", "M122-9495", "M763-8737", "M099-6166", "M282-6906",
  "M346-8211", "M606-3993", "M160-4528", "M110-1645", "M168-7445",
  "M116-2363", "M038-6763"
]);

const find = (reference: string): ProductRecord => {
  const record = records.find((source) => source.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Mercaeleva: acredita veintidós descripciones de diez modelos con variante y estado correctos", () => {
  const matched = records.filter((record) => resolveMercaelevaDocumentedFurtherPlatformGeneral(record));
  assert.equal(matched.length, 22);
  assert.deepEqual(new Set(matched.map((record) => record.reference)), expectedReferences);
  assert.deepEqual(new Set(matched.map((record) => `${record.brand} ${record.model}`)),
    new Set(verifiedFurtherPlatformModelDocumentation.map((doc) => `${doc.brand} ${doc.model}`)));

  for (const documentation of verifiedFurtherPlatformModelDocumentation) {
    assert.match(documentation.source, /^https:\/\//);
    assert.ok(documentation.platformHeight);
    assert.ok(documentation.nominalCapacity);
  }

  for (const record of matched) {
    const original = JSON.stringify(record);
    const documentation = verifiedFurtherPlatformModelDocumentation.find((model) =>
      record.brand === model.brand && record.model === model.model);
    assert.ok(documentation);
    const description = resolveMercaelevaDocumentedFurtherPlatformGeneral(record);
    assert.ok(description);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.description_general, description);
    assert.ok(description.split(/\s+/u).length >= 60);
    for (const detail of [documentation.manufacturerWorkHeight, documentation.platformHeight,
      documentation.nominalCapacity, documentation.dimension,
      String(record.specs?.["Artículo No."]), record.year ?? ""]) {
      assert.ok(description.includes(detail), `${record.reference}: ${detail}`);
    }
    if (record.horometer) assert.ok(description.includes(`${record.horometer} h`));
    else assert.doesNotMatch(description, /\d+ h declaradas/u);
    if (record.condition === "Nuevo") {
      assert.match(description, /anuncia la unidad como nueva/u);
      assert.doesNotMatch(description, /esta unidad como usada/u);
    } else {
      assert.match(description, /identifica esta unidad como usada/u);
    }
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.deepEqual(prepared.product.spec, record.specs);
    assert.equal(JSON.stringify(record), original);
  }
});

test("Mercaeleva: bloquea fuentes incoherentes y evita reescribir las fichas acreditadas antes", () => {
  for (const reference of ["M342-3553", "M687-7610", "M517-8202", "M005-4474", "M159-0669"]) {
    assert.equal(resolveMercaelevaDocumentedFurtherPlatformGeneral(find(reference)), null, reference);
  }
  for (const reference of expectedReferences) {
    const record = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, reference: `${reference}-variante` },
      { ...record, url: `${record.url}?variante=1` },
      { ...record, brand: "Otra marca" },
      { ...record, model: "Otro modelo" },
      { ...record, year: record.year === "2026" ? "2010" : "2026" },
      { ...record, horometer: "99999" },
      { ...record, longDescription: `${record.longDescription} sin acreditar` },
      { ...record, specs: { ...record.specs, "Estado": "Desconocido" } },
      { ...record, specs: { ...record.specs, "Condición general": "Desconocido" } },
      { ...record, specs: { ...record.specs, "Tipo de motor": "Otro" } },
      { ...record, specs: { ...record.specs, "Altura de trabajo": "25 m" } },
      { ...record, specs: { ...record.specs, "Artículo No.": "otro" } },
      { ...record, specs: { ...record.specs, "Año de fabricación": record.year === "2026" ? "2010" : "2026" } },
      { ...record, specs: { ...record.specs, "Horas laborales": "99999 h" } }
    ];
    for (const [index, variant] of variants.entries()) {
      assert.equal(resolveMercaelevaDocumentedFurtherPlatformGeneral(variant), null, `${reference}:${index}`);
    }
  }
});

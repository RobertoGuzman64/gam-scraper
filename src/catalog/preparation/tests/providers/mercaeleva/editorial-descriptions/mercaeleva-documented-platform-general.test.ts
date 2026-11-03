import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readMercaelevaSource } from "../../../../../../testing/builders/mercaeleva-source-fixture.js";
import { verifiedPlatformModelDocumentation } from "../../../../evidence/providers/mercaeleva/platform-model-documentation.js";
import { resolveMercaelevaDocumentedPlatformGeneral } from "../../../../mapping/providers/mercaeleva/documented-platform-general.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const sources = await readMercaelevaSource();
const targets = new Set([
  "M373-1461", "M352-1310", "M032-4313", "M931-4108", "M750-3069",
  "M775-6522", "M795-6850", "M674-6716", "M829-6181", "M726-9929",
  "M953-7579", "M825-8158", "M034-3284", "M345-0184", "M308-4683",
  "M987-2983", "M778-4251", "M201-8398", "M690-8650", "M715-6049"
]);

const find = (reference: string): ProductRecord => {
  const record = sources.find((source) => source.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Mercaeleva: amplía veinte generales con evidencia del modelo y datos de la unidad", () => {
  const matched = sources.filter((record) =>
    resolveMercaelevaDocumentedPlatformGeneral(record)?.startsWith("La plataforma de tijera eléctrica "));
  assert.deepEqual(new Set(matched.map((record) => record.reference)), targets);
  assert.equal(verifiedPlatformModelDocumentation.length, 3);
  assert.deepEqual(new Set(matched.map((record) => `${record.brand} ${record.model}`)),
    new Set(verifiedPlatformModelDocumentation.map((item) => `${item.brand} ${item.model}`)));

  for (const documentation of verifiedPlatformModelDocumentation) {
    assert.match(documentation.source, /^https:\/\//);
  }

  for (const record of matched) {
    const original = JSON.stringify(record);
    const documentation = verifiedPlatformModelDocumentation.find((entry) =>
      entry.brand === record.brand && entry.model === record.model);
    assert.ok(documentation);
    const general = resolveMercaelevaDocumentedPlatformGeneral(record);
    assert.ok(general);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.description_general, general);
    assert.ok(general.split(/\s+/u).length >= 60);
    assert.ok(general.includes(documentation.platformHeight));
    assert.ok(general.includes(documentation.nominalCapacity));
    assert.ok(general.includes(record.year ?? "año ausente"));
    assert.ok(general.includes(String(record.specs?.["Artículo No."] ?? "artículo ausente")));
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.deepEqual(prepared.product.spec, record.specs);
    assert.equal(JSON.stringify(record), original);
  }
});

test("Mercaeleva: rechaza reutilizar evidencia de otra unidad o características contradictorias", () => {
  for (const reference of targets) {
    const record = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, reference: `${reference}-otro` },
      { ...record, url: `${record.url}?otro=1` },
      { ...record, model: "otro modelo" },
      { ...record, brand: "otra marca" },
      { ...record, year: "2025" },
      { ...record, horometer: "999999" },
      { ...record, longDescription: `${record.longDescription} prestaciones no verificadas` },
      { ...record, specs: { ...record.specs, "Estado": "Nuevo" } },
      { ...record, specs: { ...record.specs, "Condición general": "Desconocida" } },
      { ...record, specs: { ...record.specs, "Tipo de motor": "Diésel" } },
      { ...record, specs: { ...record.specs, "Altura de trabajo": "20 m" } },
      { ...record, specs: { ...record.specs, "Horas laborales": "999999 h" } },
      { ...record, specs: { ...record.specs, "Artículo No.": "otro" } }
    ];
    for (const [index, variant] of variants.entries()) {
      assert.equal(resolveMercaelevaDocumentedPlatformGeneral(variant), null, `${reference}:${index}`);
    }
  }
});

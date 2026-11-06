import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readMercaelevaSource } from "../../../../testing/builders/mercaeleva-source-fixture.js";
import { verifiedArticulatedPlatformModelDocumentation } from "../../technical/evidence/articulated-platform-model-documentation.js";
import { resolveMercaelevaDocumentedPlatformGeneral } from "../mapping/documented-platform-general.js";
import { recoverMercaelevaDocumentedPlatformTechnicalSpecs } from "../../technical/evidence/documented-platform-technical-specs.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const sources = await readMercaelevaSource();
const targets = new Set([
  "M869-4472", "M448-2901", "M696-2742", "M577-4076", "M212-3717", "M237-2621",
  "M921-0545", "M709-8662", "M158-2594", "M274-8210", "M819-0909", "M911-4028",
  "M873-8524", "M547-8652", "M051-3155", "M711-4051", "M417-9896", "M391-7199",
  "M384-3098", "M408-7290"
]);

const find = (reference: string): ProductRecord => {
  const record = sources.find((source) => source.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Mercaeleva: documenta veinte articuladas con datos contrastados de modelo y unidad", () => {
  const matched = sources.filter((record) =>
    resolveMercaelevaDocumentedPlatformGeneral(record)?.startsWith("La plataforma articulada eléctrica "));
  assert.deepEqual(new Set(matched.map((record) => record.reference)), targets);
  assert.deepEqual(new Set(matched.map((record) => `${record.brand} ${record.model}`)),
    new Set(verifiedArticulatedPlatformModelDocumentation.map((model) => `${model.brand} ${model.model}`)));

  for (const documentation of verifiedArticulatedPlatformModelDocumentation) {
    assert.match(documentation.source, /^https:\/\//);
  }

  for (const record of matched) {
    const original = JSON.stringify(record);
    const documentation = verifiedArticulatedPlatformModelDocumentation.find((model) =>
      record.brand === model.brand && record.model === model.model);
    assert.ok(documentation);
    const general = resolveMercaelevaDocumentedPlatformGeneral(record);
    assert.ok(general);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.description_general, general);
    assert.ok(general.split(/\s+/u).length >= 60);
    assert.ok(general.includes(documentation.platformHeight));
    assert.ok(general.includes(documentation.horizontalOutreach));
    assert.ok(general.includes(documentation.nominalCapacity));
    assert.ok(general.includes(record.year ?? "año no informado"));
    assert.ok(general.includes(String(record.specs?.["Artículo No."] ?? "artículo no informado")));
    if (record.horometer) assert.ok(general.includes(`${record.horometer} h`));
    else assert.doesNotMatch(general, /horas de uso registradas|con \d+ h registradas/u);
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.deepEqual(prepared.product.spec, recoverMercaelevaDocumentedPlatformTechnicalSpecs(record, record.specs ?? {}));
    assert.equal(JSON.stringify(record), original);
  }
});

test("Mercaeleva: no incorpora fichas con conflictos de horas, referencias, variantes o procedencia", () => {
  for (const reference of ["M988-6161", "M106-1389", "M310-8756", "M887-9469", "M840-6795"]) {
    const record = find(reference);
    const general = resolveMercaelevaDocumentedPlatformGeneral(record);
    assert.ok(!general?.startsWith("La plataforma articulada eléctrica "), reference);
  }

  for (const reference of targets) {
    const record = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, reference: `${reference}-otra` },
      { ...record, url: `${record.url}?otra=1` },
      { ...record, brand: "Otra marca" },
      { ...record, model: "Otro modelo" },
      { ...record, year: "2026" },
      { ...record, horometer: "99999" },
      { ...record, longDescription: `${record.longDescription} dato no contrastado` },
      { ...record, specs: { ...record.specs, "Estado": "Nuevo" } },
      { ...record, specs: { ...record.specs, "Condición general": "Desconocida" } },
      { ...record, specs: { ...record.specs, "Tipo de motor": "Diésel" } },
      { ...record, specs: { ...record.specs, "Altura de trabajo": "22 m" } },
      { ...record, specs: { ...record.specs, "Artículo No.": "otro" } },
      { ...record, specs: { ...record.specs, "Año de fabricación": "2026" } },
      { ...record, specs: { ...record.specs, "Horas laborales": "99999 h" } }
    ];
    for (const [index, variant] of variants.entries()) {
      assert.equal(resolveMercaelevaDocumentedPlatformGeneral(variant), null, `${reference}:${index}`);
    }
  }
});

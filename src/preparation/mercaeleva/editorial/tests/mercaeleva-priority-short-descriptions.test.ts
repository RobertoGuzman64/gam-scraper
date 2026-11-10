import { recoverMercaelevaDocumentedSourceSpecs } from "../../technical/evidence/documented-source-recovery.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readMercaelevaSource } from "../../../../testing/builders/mercaeleva-source-fixture.js";
import { recoverMercaelevaDocumentedToyotaForkliftSpecs } from "../../technical/evidence/documented-toyota-forklift-specs.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { recoverMercaelevaDocumentedLiftingAndWarehouseSpecs } from "../../technical/evidence/documented-lifting-and-warehouse-specs.js";
import { mercaelevaPriorityShortEvidence, verifiedMercaelevaPriorityShortDescription } from "../evidence/priority-short-descriptions.js";

const records = await readMercaelevaSource();
const references = Object.keys(mercaelevaPriorityShortEvidence);

const find = (reference: string): ProductRecord => {
  const record = records.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera las cortas prioritarias sin alterar los originales ni sus contradicciones", () => {
  for (const reference of references) {
    const record = find(reference);
    const before = JSON.stringify(record);
    const expected = verifiedMercaelevaPriorityShortDescription(record);
    assert.ok(expected, reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(record.shortDescription, null, reference);
    assert.ok(prepared.product.description, reference);
    assert.ok(prepared.product.description_general, reference);
    const { documentedSpecs } = recoverMercaelevaDocumentedSourceSpecs(record, record.specs ?? {});
    const technicalSpecs = recoverMercaelevaDocumentedToyotaForkliftSpecs(record,
      recoverMercaelevaDocumentedLiftingAndWarehouseSpecs(record, documentedSpecs));
    assert.deepEqual(prepared.product.spec, reference === "M838-0666" || reference === "M969-4655" ? { ...technicalSpecs, Modelo: "450 AJ" } : technicalSpecs, reference);
    assert.equal(JSON.stringify(record), before, reference);
    const evidence = Object.values(mercaelevaPriorityShortEvidence).find((item) => item.reference === reference);
    assert.ok(evidence);
    assert.match(evidence.manufacturerSource, /^https:\/\//u);
    assert.doesNotMatch(expected, /MER0825|MER0525|RPL201H|\b686\b|\b689\b|\b15,8\b/iu);
  }
});

test("no traslada las cortas a identidades, especificaciones o evidencias alteradas", () => {
  for (const reference of references) {
    const record = find(reference);
    const key = reference === "M168-3277" ? "Capacidad máxima de elevación" :
      reference === "M011-3720" ? "Capacidad de carga" :
      reference === "M547-2372" ? "Artículo No." : "Altura de trabajo";
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, categoryKey: "alquiler" },
      { ...record, reference: "M000-0000" },
      { ...record, url: record.url.replace("sales.mercaeleva.com", "example.com") },
      { ...record, model: "OTRO MODELO" },
      { ...record, title: `${record.title} CAMBIADO` },
      { ...record, longDescription: `${record.longDescription} ALTERADA` },
      { ...record, shortDescription: "Ya existe una corta" },
      { ...record, specs: { ...record.specs, [key]: "otro valor" } },
      { ...record, specs: { ...record.specs, Modelo: "OTRO MODELO" } },
      { ...record, year: "2020" },
      { ...record, horometer: "2 h" }
    ];
    for (const variant of variants) {
      assert.equal(verifiedMercaelevaPriorityShortDescription(variant), null, reference);
    }
  }
});

test("las reglas prioritarias no afectan a otras fichas de Mercaeleva", () => {
  const changed = records.filter((record) => verifiedMercaelevaPriorityShortDescription(record) !== null);
  assert.deepEqual(changed.map((record) => record.reference).sort(), [...references].sort());
});


test("las dos JLG conservan sus datos individuales sin publicar una serie no demostrada", () => {
  for (const reference of ["M838-0666", "M969-4655"]) {
    const source = find(reference);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.issues, [], reference);
    assert.equal(prepared.product.spec?.Modelo, "450 AJ", reference);
    assert.equal(prepared.product.description, verifiedMercaelevaPriorityShortDescription(source), reference);
    assert.doesNotMatch(`${prepared.product.title} ${prepared.product.description} ${prepared.product.description_general} ${JSON.stringify(prepared.product.spec)}`, /\bSII\b|\bSIII\b/iu, reference);
    assert.match(prepared.product.description_general ?? "", /no acreditan la configuraci[oó]n ni las prestaciones de esta unidad/iu, reference);
  }
  const reach = prepareSourceProduct(find("M547-2372"));
  assert.equal(reach.status, "ready");
  assert.match(reach.product.description ?? "", /carretilla retr[aá]ctil el[eé]ctrica/iu);
  assert.doesNotMatch(reach.product.description_general ?? "", /transpalet/iu);
});

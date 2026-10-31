import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readMercaelevaAccreditedBaseline } from "../../../testing/accredited-publication-fixture.js";
import { reconstructMercaelevaSource } from "../../diagnostics/description-source.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { mercaelevaPriorityShortEvidence, verifiedMercaelevaPriorityShortDescription } from "../evidence/providers/mercaeleva/priority-short-descriptions.js";

const publication = await readMercaelevaAccreditedBaseline(process.cwd());
const records = publication.products.map(reconstructMercaelevaSource);
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
    assert.equal(prepared.product.description, expected, reference);
    assert.equal(prepared.product.description_general, record.longDescription, reference);
    assert.deepEqual(prepared.product.spec, record.specs, reference);
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


test("las discrepancias de familia y versión siguen notificadas sin contaminar las cortas", () => {
  for (const reference of ["M838-0666", "M969-4655", "M547-2372"]) {
    const source = find(reference);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "review", reference);
    assert.ok(prepared.issues.some((issue) => /contradictori/iu.test(issue)), reference);
    assert.equal(prepared.product.description_general, source.longDescription, reference);
    assert.deepEqual(prepared.product.spec, source.specs, reference);
    assert.doesNotMatch(prepared.product.description ?? "", /SII|SIII|transpalet/iu, reference);
  }
  assert.match(prepareSourceProduct(find("M547-2372")).product.description ?? "", /carretilla retr[aá]ctil el[eé]ctrica/iu);
});

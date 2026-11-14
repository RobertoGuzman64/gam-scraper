import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord, accreditedSourceSamples } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const tennantHybrid = accreditedSourceRecord("gam-original", "4019");
const tennantSweeper = accreditedSourceRecord("gam-original", "4025");
const tennantMeasured = accreditedSourceRecord("gam-original", "6150");
const tennantScrubber = accreditedSourceRecord("gam-original", "3997");
const modula250 = accreditedSourceRecord("gam-original", "3425");
const modula500 = accreditedSourceRecord("gam-original", "3426");
const modula3100 = accreditedSourceRecord("gam-original", "3428");
const modula1300 = accreditedSourceRecord("gam-original", "3434");

const anotherUnit = (source: ProductRecord, reference: string, retainGeneral = false): ProductRecord => ({
  ...source,
  reference,
  url: source.url?.replace(`/${source.reference}-`, `/${reference}-`) ?? null,
  shortDescription: null,
  longDescription: retainGeneral ? source.longDescription : null,
  year: null,
  horometer: null,
  serialNumber: null
});

test("RE045: los originales Tennant específicos conservan únicamente su evidencia histórica firmada", () => {
  for (const source of [tennantHybrid, tennantSweeper, tennantMeasured]) {
    const snapshot = JSON.stringify(source);
    const knowledge = resolveKnowledgeEditorial(source);
    assert.match(knowledge.short ?? "", /Tennant/iu);
    assert.match(knowledge.general ?? "", /Tennant/iu);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", source.reference ?? "");
    assert.match(prepared.product.description ?? "", /Tennant/iu);
    assert.match(prepared.product.description_general ?? "", /Tennant/iu);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE045: la barredora y la fregadora con medidas verificadas reutilizan hechos técnicos", () => {
  for (const { source, family } of [
    { source: tennantMeasured, family: "barredora" },
    { source: tennantScrubber, family: "fregadora" }
  ] as const) {
    const incoming = anotherUnit(source, source === tennantMeasured ? "7150" : "7997");
    const facts = resolveEditorialFacts(incoming);
    assert.equal(facts?.family, family);
    assert.equal(resolveKnowledgeEditorial(incoming).general, null);
    assert.match(resolveReusableEditorial(incoming).short ?? "", /Tennant/iu);
    assert.equal(prepareSourceProduct(incoming).status, "ready");
    assert.equal(prepareSourceProduct(incoming).product.reference, incoming.reference);
  }
});

test("RE045: las fichas especiales no transfieren afirmaciones firmadas a una unidad sin evidencia", () => {
  for (const source of [tennantHybrid, tennantSweeper]) {
    const incoming = anotherUnit(source, source === tennantHybrid ? "7019" : "7025");
    assert.equal(resolveKnowledgeEditorial(incoming).general, null);
    assert.equal(resolveKnowledgeEditorial(incoming).short, null);
    assert.notEqual(prepareSourceProduct(incoming).status, "ready");
    const withSource = { ...incoming, longDescription: source.longDescription };
    const prepared = prepareSourceProduct(withSource);
    assert.equal(prepared.status, "ready");
    assert.equal(resolveKnowledgeEditorial(withSource).general, null);
    assert.match(prepared.product.description_general ?? "", /Tennant/iu);
    assert.equal(prepared.product.reference, incoming.reference);
    assert.equal(prepared.product.sourceUrl, incoming.url);
  }
});

test("RE045: una identidad o procedencia alterada no desbloquea conocimiento histórico Tennant", () => {
  for (const source of [tennantHybrid, tennantSweeper, tennantMeasured]) {
    for (const changed of [
      { ...source, reference: "UNIDAD-DISTINTA" },
      { ...source, providerId: "otro-proveedor" },
      { ...source, brand: "OTRA MARCA" },
      { ...source, model: "OTRO MODELO" },
      { ...source, url: "https://example.invalid/tennant" },
      { ...source, longDescription: "Contenido externo incompatible" }
    ]) {
      const signed = resolveKnowledgeEditorial(changed);
      assert.equal(signed.short, null);
      assert.equal(signed.general, null);
    }
  }
});

test("RE046: el almacén vertical Modula se compone con alturas propias de cada modelo", () => {
  for (const { source, height } of [
    { source: modula250, height: 2.5 },
    { source: modula500, height: 2.5 },
    { source: modula3100, height: 3.1 },
    { source: modula1300, height: 1.3 }
  ] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "almacen-vertical");
    assert.equal(facts.heightM, height);
    assert.equal(facts.loadCapacityKg, null);
    assert.equal(facts.trayCapacityKg, null);
    const shared = resolveReusableEditorial(source);
    assert.match(shared.short ?? "", /Almacén automático vertical MODULA/u);
    assert.match(shared.general ?? "", /altura del equipo/u);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.match(prepared.product.description_general ?? "", /altura del equipo/u);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE046: la carga declarada por bandeja no se confunde entre modelos ni se hereda de unidades firmadas", () => {
  const original250 = prepareSourceProduct(modula250).product;
  const original500 = prepareSourceProduct(modula500).product;
  assert.match(original250.description_general ?? "", /bandeja de 250 kg/u);
  assert.doesNotMatch(original250.description_general ?? "", /bandeja de 500 kg/u);
  assert.match(original500.description_general ?? "", /bandeja de 500 kg/u);
  assert.doesNotMatch(original500.description_general ?? "", /bandeja de 250 kg/u);
  const incoming = anotherUnit(modula250, "7425");
  const changed: ProductRecord = {
    ...incoming,
    title: incoming.title?.replace("2,5M", "3,1M") ?? null,
    specs: { ...incoming.specs, Altura: "3100 mm" }
  };
  const snapshot = JSON.stringify(changed);
  assert.equal(resolveEditorialFacts(changed)?.heightM, 3.1);
  assert.match(resolveReusableEditorial(changed).general ?? "", /3,1 m/u);
  const prepared = prepareSourceProduct(changed);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description_general ?? "", /3,1 m/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /bandeja de 250 kg|altura del equipo de 2,5 m/u);
  assert.equal(JSON.stringify(changed), snapshot);
});

test("RE046: identidad, procedencia y familia incompatibles no acreditan datos de almacén vertical", () => {
  for (const source of [modula250, modula500, modula3100]) {
    for (const variant of [
      { ...source, providerId: "proveedor-no-acreditado" },
      { ...source, url: "https://example.invalid/modula" },
      { ...source, brand: "OTRA MARCA" },
      { ...source, model: "OTRO MODELO" },
      { ...source, specs: { ...source.specs, Modelo: "OTRO MODELO" } },
      { ...source, title: "Plataforma articulada MODULA de 3 metros" }
    ]) {
      assert.equal(resolveEditorialFacts(variant), null);
      assert.deepEqual(resolveReusableEditorial(variant), { short: null, general: null });
    }
  }
});


test("RE045: el conjunto histórico Tennant conserva todas las fichas sin universalizar firmas individuales", () => {
  const originals = accreditedSourceSamples("gam-original")
    .filter((item) => /tennant/iu.test(`${item.brand ?? ""} ${item.title ?? ""}`));
  assert.equal(originals.length, 51);
  let signed = 0;
  for (const source of originals) {
    const knowledge = resolveKnowledgeEditorial(source);
    if (knowledge.short !== null || knowledge.general !== null) signed++;
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", source.reference ?? "");
    assert.equal(prepared.product.reference, source.reference);
  }
  assert.equal(signed, 45);
});

test("RE046: el conjunto histórico Modula y un título antiguo excepcional respetan la separación entre firma y familia compartida", () => {
  const originals = accreditedSourceSamples("gam-original")
    .filter((item) => item.brand?.toUpperCase() === "MODULA");
  assert.equal(originals.length, 12);
  let shared = 0;
  for (const source of originals) {
    assert.equal(prepareSourceProduct(source).status, "ready", source.reference ?? "");
    if (resolveEditorialFacts(source)?.family === "almacen-vertical") shared++;
  }
  assert.equal(shared, 11);
  const historical = accreditedSourceRecord("gam-original", "3427");
  assert.equal(resolveEditorialFacts(historical), null);
  const incoming: ProductRecord = {
    ...anotherUnit(historical, "7427"),
    title: "Almacén automático vertical 2,5M 750Kg MODULA MC75D"
  };
  assert.equal(resolveEditorialFacts(incoming)?.family, "almacen-vertical");
  assert.equal(resolveEditorialFacts(incoming)?.heightM, 2.5);
  assert.equal(prepareSourceProduct(incoming).status, "ready");
  assert.doesNotMatch(prepareSourceProduct(incoming).product.description_general ?? "", /bandeja de 750 kg/u);
});

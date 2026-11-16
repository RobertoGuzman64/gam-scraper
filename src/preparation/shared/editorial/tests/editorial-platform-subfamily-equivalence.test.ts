import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { editorialFamilyOf } from "../domain/editorial-families.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const electricScissor = accreditedSourceRecord("gomariz-original", "TE1591");
const dieselScissor = accreditedSourceRecord("mercaeleva-original", "M198-7237");
const gamElectric = accreditedSourceRecord("gam-original", "6937");
const gamDiesel = accreditedSourceRecord("gam-original", "6997");
const telescopic = accreditedSourceRecord("gomariz-original", "BT1461");
const longReachTelescopic = accreditedSourceRecord("gomariz-original", "BT1102");
const gamTelescopic = accreditedSourceRecord("gam-original", "4782");

const newUnit = (
  source: ProductRecord, reference: string, technical: NonNullable<ProductRecord["specs"]>,
  title: string | null = source.title
): ProductRecord => {
  const url = source.providerId === "mercaeleva" ?
    source.url.replace(`-${source.reference}`, `-${reference}`) :
    source.providerId === "gam" ? source.url.replace(`/${source.reference}-`, `/${reference}-`) :
      `${source.url.replace(/\/$/u, "")}-otra-unidad/`;
  return {
    ...source, reference, url, title, year: null, horometer: null, serialNumber: null,
    shortDescription: null, longDescription: null, image: null, images: [],
    specs: { ...source.specs, ...technical }
  };
};

test("tijeras eléctricas y diésel de tres proveedores conservan familia y magnitudes propias", () => {
  for (const [source, expectedEnergy] of [
    [electricScissor, "eléctrica"], [dieselScissor, "diésel"],
    [gamElectric, null], [gamDiesel, null]
  ] as const) {
    const original = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "plataforma-tijera", source.reference ?? "");
    assert.equal(facts.energy, expectedEnergy);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", source.reference ?? "");
    assert.equal(prepared.product.reference, source.reference);
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.match(prepared.product.title ?? "", /[Tt]ijera/u);
    assert.equal(JSON.stringify(source), original);
  }
  assert.equal(resolveEditorialFacts(electricScissor)?.workingHeightM, 10);
  assert.equal(resolveEditorialFacts(dieselScissor)?.workingHeightM, 22);
  assert.equal(resolveEditorialFacts(gamElectric)?.workingHeightM, null);
  assert.equal(resolveEditorialFacts(gamElectric)?.liftingHeightM, 8);
});

test("nuevas tijeras compatibles reutilizan composición sin copiar atributos ni textos firmados", () => {
  const electric = newUnit(electricScissor, "TE2591", { Capacidad: "400 kg" });
  const diesel = newUnit(dieselScissor, "M198-7238", {
    "Altura de trabajo": "20 m", "Título adicional": "PLATAFORMA TIJERA DIESEL 20 MT"
  }, "JLG SL203-204 PLATAFORMA TIJERA DIESEL 20 MT");
  for (const [source, familyEnergy, own, historical] of [
    [electric, "eléctrica", "400 kg", "450 kg"],
    [diesel, "diésel", "20 m", "22 m"]
  ] as const) {
    const snapshot = JSON.stringify(source);
    assert.equal(resolveEditorialFacts(source)?.family, "plataforma-tijera");
    assert.equal(resolveEditorialFacts(source)?.energy, familyEnergy);
    assert.equal(resolveKnowledgeEditorial(source).general, null);
    const shared = resolveReusableEditorial(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.reference, source.reference);
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.ok(shared.general?.includes(own));
    assert.ok(prepared.product.description_general?.includes(own));
    assert.ok(!shared.general?.includes(historical));
    assert.ok(!prepared.product.description_general?.includes(historical));
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("fuentes telescópicas históricas se reconocen sin confundir boom lift con articulada", () => {
  assert.equal(editorialFamilyOf("telescopic boom lift"), "plataforma-telescopica");
  assert.equal(editorialFamilyOf("brazo telescópico telescopic boom lift"), "plataforma-telescopica");
  assert.equal(editorialFamilyOf("articulated boom lift"), "plataforma-articulada");
  assert.equal(editorialFamilyOf("boom lift"), null);
  assert.equal(editorialFamilyOf("brazo articulado telescopic boom lift"), null);
  for (const [source, expectedHeight, expectedLoad] of [
    [telescopic, 15.6, 227], [longReachTelescopic, 43.15, 454]
  ] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "plataforma-telescopica");
    assert.equal(facts.energy, "diésel");
    assert.equal(facts.workingHeightM, expectedHeight);
    assert.equal(facts.loadCapacityKg, expectedLoad);
    const result = prepareSourceProduct(source);
    assert.equal(result.status, "ready");
    assert.equal(result.product.sourceUrl, source.url);
    if (source.reference === telescopic.reference) {
      assert.equal(result.product.description_general, resolveKnowledgeEditorial(source).fallbackGeneral);
    }
    assert.equal(JSON.stringify(source), snapshot);
  }
  assert.equal(resolveEditorialFacts(gamTelescopic)?.family, "plataforma-telescopica");
  assert.equal(resolveEditorialFacts(gamTelescopic)?.energy, "diésel");
  assert.equal(resolveEditorialFacts(gamTelescopic)?.liftingHeightM, 16);
});

test("otra telescópica consume solo sus magnitudes, sin heredar la firma del original", () => {
  const source = newUnit(telescopic, "BT1462", {
    Altura: "15 metros", "Altura de trabajo": "14.50 m", Capacidad: "215 kg"
  });
  const snapshot = JSON.stringify(source);
  const facts = resolveEditorialFacts(source);
  assert.equal(facts?.family, "plataforma-telescopica");
  assert.equal(facts.workingHeightM, 14.5);
  assert.equal(facts.loadCapacityKg, 215);
  assert.equal(facts.energy, "diésel");
  assert.equal(resolveKnowledgeEditorial(source).general, null);
  assert.equal(resolveKnowledgeEditorial(source).title, null);
  const shared = resolveReusableEditorial(source);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.reference, "BT1462");
  assert.equal(prepared.product.sourceUrl, source.url);
  assert.match(shared.general ?? "", /altura de trabajo de 14,5 m/u);
  assert.match(prepared.product.description_general ?? "", /capacidad de 215 kg/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /15,6 m|227 kg|unidad de 2017/u);
  assert.equal(JSON.stringify(source), snapshot);
});

test("identidad, proveedor, familia, negaciones técnicas y unidades incompatibles se excluyen", () => {
  for (const source of [electricScissor, telescopic]) {
    for (const invalid of [
      { ...source, providerId: "otro-proveedor" },
      { ...source, url: "https://example.invalid/venta/plataforma/" },
      { ...source, brand: "OTRA MARCA" },
      { ...source, model: "OTRO-MODELO" },
      { ...source, condition: "Nuevo" as const },
      { ...source, specs: { ...source.specs, "Altura de trabajo": "15 kg" } },
      { ...source, specs: { ...source.specs, Capacidad: "200 m" } }
    ]) {
      assert.equal(resolveEditorialFacts(invalid), null, `${source.reference}: ${invalid.url}`);
      assert.deepEqual(resolveReusableEditorial(invalid), { short: null, general: null });
    }
  }
  assert.equal(resolveEditorialFacts({ ...electricScissor, title: "Plataforma telescópica LGMG AS0812" }), null);
  assert.equal(resolveEditorialFacts({ ...telescopic, title: "Plataforma articulada Skyjack SJ45T" }), null);
  assert.equal(resolveEditorialFacts({ ...electricScissor, specs: { ...electricScissor.specs, Motor: "Diésel" } }), null);
  const noCapacity = newUnit(telescopic, "BT1462", { Capacidad: "200 m" });
  assert.equal(resolveEditorialFacts(noCapacity), null);
});

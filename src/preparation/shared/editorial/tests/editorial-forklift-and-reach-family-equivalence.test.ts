import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";

const dieselGam = accreditedSourceRecord("gam-original", "6024");
const electricGam = accreditedSourceRecord("gam-original", "6878");
const glpGam = accreditedSourceRecord("gam-original", "6682");
const electricMercaeleva = accreditedSourceRecord("mercaeleva-original", "M208-7097");
const reachGam = accreditedSourceRecord("gam-original", "6950");
const reachOtherGam = accreditedSourceRecord("gam-original", "2117");
const contradictoryReach = accreditedSourceRecord("mercaeleva-original", "M547-2372");

const newUnit = (
  source: ProductRecord,
  reference: string,
  specs: NonNullable<ProductRecord["specs"]>
): ProductRecord => ({
  ...source,
  reference,
  url: source.providerId === "gam" ? source.url?.replace(`/${source.reference}-`, `/${reference}-`) ?? null :
    source.url?.replace(source.reference ?? "", reference) ?? null,
  shortDescription: null,
  longDescription: null,
  year: null,
  horometer: null,
  serialNumber: null,
  specs: { ...source.specs, ...specs }
});

test("RE036: carretillas frontales GAM diésel, eléctrica y GLP conservan familia, carga y elevación", () => {
  const cases = [
    { source: dieselGam, load: 2000, lift: 4, motor: /diésel/u },
    { source: electricGam, load: 1600, lift: 4.6, motor: /eléctrica/u },
    { source: glpGam, load: 3500, lift: 3.11, motor: /de GLP/u }
  ] as const;
  for (const { source, load, lift, motor } of cases) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "carretilla-elevadora");
    assert.equal(facts.loadCapacityKg, load);
    assert.equal(facts.liftingHeightM, lift);
    const shared = resolveReusableEditorial(source);
    assert.match(shared.short ?? "", /Carretilla elevadora /u);
    assert.match(shared.general ?? "", /capacidad de carga de /u);
    assert.match(shared.general ?? "", /altura de elevación de /u);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.match(prepared.product.description ?? "", motor);
    assert.equal(prepared.product.reference, source.reference);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE036: una carretilla Mercaeleva válida reutiliza hechos propios sin desplazar su evidencia firmada", () => {
  const snapshot = JSON.stringify(electricMercaeleva);
  const facts = resolveEditorialFacts(electricMercaeleva);
  assert.equal(facts?.family, "carretilla-elevadora");
  assert.equal(facts.loadCapacityKg, 1800);
  assert.equal(facts.liftingHeightM, 5.5);
  assert.match(resolveReusableEditorial(electricMercaeleva).general ?? "", /altura de elevación de 5,5 m/u);
  const prepared = prepareSourceProduct(electricMercaeleva);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description_general ?? "", /1\.800 kg/u);
  assert.equal(prepared.product.sourceUrl, electricMercaeleva.url);
  assert.equal(JSON.stringify(electricMercaeleva), snapshot);
});

test("RE037: retráctiles GAM mantienen su familia específica y sus medidas independientes", () => {
  for (const { source, load, lift } of [
    { source: reachGam, load: 1600, lift: 7.4 },
    { source: reachOtherGam, load: 1600, lift: 11.4 }
  ] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "carretilla-retractil");
    assert.equal(facts.loadCapacityKg, load);
    assert.equal(facts.liftingHeightM, lift);
    const shared = resolveReusableEditorial(source);
    assert.match(shared.short ?? "", /Carretilla retráctil /u);
    assert.match(shared.general ?? "", /carretilla retráctil /u);
    assert.doesNotMatch(shared.general ?? "", /carretilla frontal /u);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.match(prepared.product.description_general ?? "", /carretilla retráctil /u);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE036–RE037: nuevas unidades compatibles reutilizan el motor con alturas propias", () => {
  const cases = [
    { source: dieselGam, reference: "8024", height: "4400 mm", claim: "altura de elevación de 4,4 m", previous: "altura de elevación de 4 m" },
    { source: electricGam, reference: "7878", height: "5100 mm", claim: "altura de elevación de 5,1 m", previous: "altura de elevación de 4,6 m" },
    { source: glpGam, reference: "7682", height: "3210 mm", claim: "altura de elevación de 3,21 m", previous: "altura de elevación de 3,11 m" },
    { source: reachGam, reference: "7950", height: "8000 mm", claim: "altura de elevación de 8 m", previous: "altura de elevación de 7,4 m" }
  ] as const;
  for (const { source, reference, height, claim, previous } of cases) {
    const incoming = newUnit(source, reference, { "Altura de elevación (mm)": height });
    const snapshot = JSON.stringify(incoming);
    const facts = resolveEditorialFacts(incoming);
    assert.ok(facts);
    assert.equal(facts.family, resolveEditorialFacts(source)?.family);
    assert.equal(facts.loadCapacityKg, resolveEditorialFacts(source)?.loadCapacityKg);
    const shared = resolveReusableEditorial(incoming);
    assert.ok(shared.general?.includes(claim), reference);
    assert.ok(!shared.general?.includes(previous), reference);
    const prepared = prepareSourceProduct(incoming);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, incoming.url);
    assert.ok(prepared.product.description_general?.includes(claim), reference);
    assert.equal(JSON.stringify(incoming), snapshot);
  }
  const incomingMercaeleva = newUnit(electricMercaeleva, "M808-7097", { "Altura máxima de elevación": "5800 mm" });
  const prepared = prepareSourceProduct(incomingMercaeleva);
  assert.equal(resolveEditorialFacts(incomingMercaeleva)?.liftingHeightM, 5.8);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description_general ?? "", /altura de elevación de 5,8 m/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /13\.858 horas/u);
});

test("RE036–RE037: identidad, procedencia y familia contradictorias no producen afirmaciones", () => {
  for (const source of [dieselGam, electricGam, glpGam, reachGam, reachOtherGam, electricMercaeleva]) {
    for (const incoming of [
      { ...source, providerId: "desconocido" },
      { ...source, url: "https://example.invalid/carretilla" },
      { ...source, brand: "MARCA-AJENA" },
      { ...source, model: "MODELO-AJENO" },
      { ...source, specs: { ...source.specs, Modelo: "MODELO-AJENO" } },
      { ...source, specs: { ...source.specs, "Título adicional": "Plataforma de tijera eléctrica" } }
    ]) {
      assert.equal(resolveEditorialFacts(incoming), null, `${source.reference}/${incoming.providerId}`);
      assert.deepEqual(resolveReusableEditorial(incoming), { short: null, general: null });
    }
  }
});

test("RE036–RE037: las unidades incompatibles y la ficha retráctil contradictoria quedan excluidas", () => {
  for (const source of [dieselGam, reachGam]) {
    for (const [key, value] of [
      ["Altura de elevación (mm)", "8000 kg"],
      ["Capacidad de carga (kg)", "1600 m"]
    ] as const) {
      const incoming = { ...source, specs: { ...source.specs, [key]: value } };
      assert.equal(resolveEditorialFacts(incoming), null);
      assert.deepEqual(resolveReusableEditorial(incoming), { short: null, general: null });
    }
  }
  assert.equal(resolveEditorialFacts(contradictoryReach), null);
  assert.deepEqual(resolveReusableEditorial(contradictoryReach), { short: null, general: null });
  assert.equal(prepareSourceProduct(contradictoryReach).status, "review");
});

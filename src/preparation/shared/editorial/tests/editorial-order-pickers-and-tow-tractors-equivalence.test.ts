import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";

const pickerWithLift = accreditedSourceRecord("gam-original", "2128");
const pickerWithDimensions = accreditedSourceRecord("gam-original", "6754");
const towTractorFive = accreditedSourceRecord("gam-original", "2134");
const towTractorSeven = accreditedSourceRecord("gam-original", "2135");

const newUnit = (
  source: ProductRecord,
  reference: string,
  specs: NonNullable<ProductRecord["specs"]>
): ProductRecord => ({
  ...source,
  reference,
  url: source.url?.replace(`/${source.reference}-`, `/${reference}-`) ?? null,
  shortDescription: null,
  longDescription: null,
  year: null,
  horometer: null,
  serialNumber: null,
  specs: { ...source.specs, ...specs }
});

test("RE040: recogepedidos históricos componen carga y solo la elevación técnicamente acreditada", () => {
  for (const [source, load] of [[pickerWithLift, 1000], [pickerWithDimensions, 2500]] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "recogepedidos");
    assert.equal(facts.loadCapacityKg, load);
    const shared = resolveReusableEditorial(source);
    assert.match(shared.short ?? "", /Recogepedidos /u);
    assert.match(shared.general ?? "", /capacidad de carga de /u);
    assert.doesNotMatch(shared.general ?? "", /capacidad de arrastre de /u);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.match(prepared.product.description_general ?? "", /capacidad de carga de /u);
    assert.doesNotMatch(prepared.product.description_general ?? "", /autorizad[ao] para elevar personas/u);
    assert.equal(prepared.product.reference, source.reference);
    assert.equal(JSON.stringify(source), snapshot);
  }
  assert.equal(resolveEditorialFacts(pickerWithLift)?.liftingHeightM, 4.627);
  assert.match(resolveReusableEditorial(pickerWithLift).general ?? "", /altura de elevación de 4,627 m/u);
  assert.equal(resolveEditorialFacts(pickerWithDimensions)?.liftingHeightM, null);
  assert.doesNotMatch(resolveReusableEditorial(pickerWithDimensions).general ?? "", /altura de elevación/u);
});

test("RE041: tractores originales expresan capacidad de arrastre sin convertirla en carga vertical", () => {
  for (const [source, load] of [[towTractorFive, 5000], [towTractorSeven, 7000]] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "tractor-arrastre");
    assert.equal(facts.loadCapacityKg, load);
    const shared = resolveReusableEditorial(source);
    assert.match(shared.short ?? "", /Tractor de arrastre /u);
    assert.match(shared.general ?? "", /capacidad de arrastre de /u);
    assert.doesNotMatch(shared.general ?? "", /capacidad de carga de /u);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.spec["Capacidad de carga (kg)"], undefined);
    assert.ok(prepared.product.spec["Capacidad de arrastre"]);
    assert.match(prepared.product.description_general ?? "", /capacidad de arrastre de /u);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE040–RE041: unidades nuevas compatibles usan su propia elevación, longitud y radio de giro", () => {
  const cases = [
    { source: pickerWithLift, reference: "8128", specs: { "Altura de elevación (mm)": "5127 mm" },
      expected: "altura de elevación de 5,127 m", former: "altura de elevación de 4,627 m" },
    { source: pickerWithDimensions, reference: "8754", specs: { Longitud: "4200 mm" },
      expected: "longitud de 4,2 m", former: "longitud de 4 m" },
    { source: towTractorFive, reference: "8134", specs: { "Radio de giro": "1834mm" },
      expected: "radio de giro declarado de 1,834 m", former: "radio de giro declarado de 1,434 m" },
    { source: towTractorSeven, reference: "8135", specs: { "Radio de giro": "1534mm" },
      expected: "radio de giro declarado de 1,534 m", former: "radio de giro declarado de 1,434 m" }
  ] as const;
  for (const { source, reference, specs, expected, former } of cases) {
    const incoming = newUnit(source, reference, specs);
    const snapshot = JSON.stringify(incoming);
    const shared = resolveReusableEditorial(incoming);
    assert.ok(shared.general?.includes(expected), reference);
    assert.ok(!shared.general?.includes(former), reference);
    const prepared = prepareSourceProduct(incoming);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, incoming.url);
    assert.ok(prepared.product.description_general?.includes(expected), reference);
    assert.equal(JSON.stringify(incoming), snapshot);
  }
});

test("RE040–RE041: identidades, fuentes y familias incompatibles no generan hechos reutilizables", () => {
  for (const source of [pickerWithLift, pickerWithDimensions, towTractorFive, towTractorSeven]) {
    for (const invalid of [
      { ...source, providerId: "desconocido" },
      { ...source, url: "https://example.invalid/anuncio" },
      { ...source, brand: "OTRA-MARCA" },
      { ...source, model: "OTRO-MODELO" },
      { ...source, specs: { ...source.specs, Modelo: "OTRO-MODELO" } },
      { ...source, specs: { ...source.specs, "Título adicional": source.title?.toLocaleLowerCase("es").includes("tractor") ?
        "Recogepedidos eléctrico" : "Tractor de arrastre diésel" } }
    ]) {
      assert.equal(resolveEditorialFacts(invalid), null, `${source.reference}/${invalid.providerId}`);
      assert.deepEqual(resolveReusableEditorial(invalid), { short: null, general: null });
    }
  }
});

test("RE040–RE041: magnitudes de unidad incorrectas no generan afirmaciones", () => {
  const invalidLift = { ...pickerWithLift, specs: { ...pickerWithLift.specs, "Altura de elevación (mm)": "5127 kg" } };
  assert.equal(resolveEditorialFacts(invalidLift), null);
  assert.deepEqual(resolveReusableEditorial(invalidLift), { short: null, general: null });
  const invalidRadius = { ...towTractorFive, specs: { ...towTractorFive.specs, "Radio de giro": "1834 kg" } };
  assert.equal(resolveEditorialFacts(invalidRadius)?.turningRadiusM, null);
  assert.doesNotMatch(resolveReusableEditorial(invalidRadius).general ?? "", /radio de giro declarado/u);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord, accreditedSourceSamples } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const originalElectric = accreditedSourceRecord("gam-original", "6170");
const originalCompact = accreditedSourceRecord("gam-original", "4657");
const originalExtended = accreditedSourceRecord("gam-original", "4653");
const originalTrackedScissor = accreditedSourceRecord("gam-original", "4730");

const newUnit = (source: ProductRecord, reference: string, specs: NonNullable<ProductRecord["specs"]>): ProductRecord => ({
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

test("RE032: originales CTE sobre orugas utilizan el motor compartido y conservan sus hechos", () => {
  for (const { source, height, load } of [
    { source: originalCompact, height: 17, load: 200 },
    { source: originalElectric, height: 18, load: 230 },
    { source: originalExtended, height: 27, load: 250 }
  ]) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "plataforma-oruga");
    assert.equal(facts?.liftingHeightM, height);
    assert.equal(facts?.loadCapacityKg, load);
    const reusable = resolveReusableEditorial(source);
    assert.match(reusable.short ?? "", /Plataforma sobre orugas/u);
    assert.match(reusable.general ?? "", /altura de elevación/u);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.reference, source.reference);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE032: otra unidad compatible aprovecha la misma regla sin heredar dimensiones ni carga", () => {
  for (const { source, reference, specs, expected, previous } of [
    { source: originalElectric, reference: "8170", specs: { "Longitud": "5300 mm", "Capacidad de carga (kg)": "215 KG" },
      expected: ["capacidad de 215 kg", "longitud de 5,3 m"], previous: ["capacidad de 230 kg", "longitud de 5,2 m"] },
    { source: originalExtended, reference: "8653", specs: { "Longitud": "6600 mm", "Capacidad de carga (kg)": "245 KG" },
      expected: ["capacidad de 245 kg", "longitud de 6,6 m"], previous: ["capacidad de 250 kg", "longitud de 6,461 m"] }
  ]) {
    const incoming = newUnit(source, reference, specs);
    const snapshot = JSON.stringify(incoming);
    assert.equal(resolveEditorialFacts(incoming)?.family, "plataforma-oruga");
    assert.equal(resolveKnowledgeEditorial(incoming).general, null);
    const general = resolveReusableEditorial(incoming).general ?? "";
    const prepared = prepareSourceProduct(incoming);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, incoming.url);
    for (const value of expected) {
      assert.ok(general.includes(value), value);
      assert.ok(prepared.product.description_general?.includes(value), value);
    }
    for (const value of previous) {
      assert.ok(!general.includes(value), value);
      assert.ok(!prepared.product.description_general?.includes(value), value);
    }
    assert.equal(JSON.stringify(incoming), snapshot);
  }
});

test("RE032: una familia incompatible declarada en el título no se acepta por su ruta de orugas", () => {
  for (const source of [originalCompact, originalElectric, originalExtended]) {
    const contradicted: ProductRecord = {
      ...source,
      title: `Carretilla elevadora ${source.brand} ${source.model}`
    };
    assert.equal(resolveEditorialFacts(contradicted), null);
    assert.deepEqual(resolveReusableEditorial(contradicted), { short: null, general: null });
  }
});

test("RE032: procedencia, identidad y declaración de familia incompatible bloquean composición", () => {
  const source = newUnit(originalElectric, "8170", { "Longitud": "5300 mm" });
  for (const candidate of [
    { ...source, providerId: "proveedor-no-acreditado" },
    { ...source, url: "https://example.invalid/cte" },
    { ...source, brand: "OTRA MARCA" },
    { ...source, model: "OTRO MODELO" },
    { ...source, specs: { ...source.specs, Modelo: "OTRO MODELO" } },
    { ...source, specs: { ...source.specs, "Título adicional": "Carretilla elevadora diésel" } }
  ]) {
    assert.equal(resolveEditorialFacts(candidate), null);
    assert.deepEqual(resolveReusableEditorial(candidate), { short: null, general: null });
  }
});

test("RE032: unidades y magnitudes incompatibles no se convierten en prestaciones", () => {
  const source = newUnit(originalElectric, "8170", { "Longitud": "5300 mm" });
  const wrongCapacity = { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "215 m" } };
  assert.equal(resolveEditorialFacts(wrongCapacity), null);
  assert.deepEqual(resolveReusableEditorial(wrongCapacity), { short: null, general: null });
  const wrongElevation = { ...source, specs: { ...source.specs, "Altura de elevación (m)": "18 kg" } };
  assert.equal(resolveEditorialFacts(wrongElevation)?.liftingHeightM, null);
  assert.doesNotMatch(resolveReusableEditorial(wrongElevation).general ?? "", /altura de elevación/u);
  const wrongDimension = { ...source, specs: { ...source.specs, "Longitud": "5300 kg" } };
  assert.equal(resolveEditorialFacts(wrongDimension)?.lengthM, null);
  assert.doesNotMatch(resolveReusableEditorial(wrongDimension).general ?? "", /longitud de/u);
});

test("RE032: una tijera con orugas sigue siendo tijera y no recibe hechos de las CTE", () => {
  const original = originalTrackedScissor;
  assert.equal(resolveEditorialFacts(original)?.family, "plataforma-tijera");
  assert.match(resolveReusableEditorial(original).short ?? "", /Plataforma de tijera/u);
  assert.doesNotMatch(resolveReusableEditorial(original).general ?? "", /CTE TRACCESS/u);
  const incoming = newUnit(original, "8730", { "Longitud": "1600 mm" });
  assert.equal(resolveEditorialFacts(incoming)?.family, "plataforma-tijera");
  assert.equal(prepareSourceProduct(incoming).status, "ready");
  assert.doesNotMatch(prepareSourceProduct(incoming).product.description_general ?? "", /CTE TRACCESS/u);
});

test("RE032: las orugas CTE acreditables del censo no trasladan conocimiento firmado entre unidades", () => {
  const originals = accreditedSourceSamples("gam-original")
    .filter((source) => source.brand === "CTE" && resolveEditorialFacts(source)?.family === "plataforma-oruga");
  assert.ok(originals.length >= 6);
  for (const source of originals) {
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", source.reference ?? "");
    const next = newUnit(source, `8${source.reference ?? ""}`, {});
    assert.equal(resolveKnowledgeEditorial(next).general, null);
    assert.equal(resolveEditorialFacts(next)?.family, "plataforma-oruga");
  }
});

test("RE032: originales excepcionales conservan su tratamiento sin extrapolar textos de unidad", () => {
  const sourceWithDescription = accreditedSourceRecord("gam-original", "4655");
  const sourceWithSignedGeneral = accreditedSourceRecord("gam-original", "6171");
  assert.equal(prepareSourceProduct(sourceWithDescription).status, "ready");
  assert.equal(prepareSourceProduct(sourceWithSignedGeneral).status, "ready");
  assert.equal(resolveEditorialFacts(sourceWithSignedGeneral), null);
  assert.ok(resolveKnowledgeEditorial(sourceWithSignedGeneral).general);
  const compatible = newUnit(sourceWithDescription, "84655", {});
  const facts = resolveEditorialFacts(compatible);
  assert.equal(facts?.family, "plataforma-oruga");
  assert.equal(facts?.liftingHeightM, 13.5);
  assert.equal(prepareSourceProduct(compatible).status, "ready");
  assert.equal(resolveKnowledgeEditorial(compatible).general, null);
  const unaccredited = newUnit(sourceWithSignedGeneral, "86171", {});
  assert.equal(resolveKnowledgeEditorial(unaccredited).general, null);
  assert.equal(resolveReusableEditorial(unaccredited).general, null);
  assert.equal(prepareSourceProduct(unaccredited).status, "review");
});

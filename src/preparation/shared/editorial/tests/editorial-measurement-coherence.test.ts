import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { hasEditorialAdapterHeightConflict, hasEditorialAdditionalHeightConflict, hasEditorialSourceWorkHeightConflict } from "../domain/editorial-height-consistency.js";
import { resolveMercaelevaEditorialDomainSource } from "../../../mercaeleva/editorial/mapping/domain-source.js";
import { editorialMetricOf, editorialQuantity, editorialQuantityOf } from "../domain/editorial-measurements.js";
import { resolveVerifiedTechnicalBrief } from "../domain/editorial-technical-brief.js";
import { controlledGamForklift, controlledGomarizForklift, controlledGomarizPlatform, controlledMercaelevaForklift } from "./editorial-contract-records.js";

const withSpecs = (record: ProductRecord, specs: NonNullable<ProductRecord["specs"]>): ProductRecord => ({
  ...record,
  specs: { ...record.specs, ...specs }
});

test("las medidas equivalentes se consolidan con conversión estricta y acuerdo de todos los campos", () => {
  const fields = ["Altura máxima de elevación", "Altura de elevación (mm)"];
  assert.equal(editorialMetricOf({ "Altura máxima de elevación": "4,5 m", "Altura de elevación (mm)": "4500 mm" }, fields), 4.5);
  assert.equal(editorialMetricOf({ "Altura máxima de elevación": "4,5 m", "Altura de elevación (mm)": "4900 mm" }, fields), null);
  assert.equal(editorialMetricOf({ "Altura máxima de elevación": "4,5 kg", "Altura de elevación (mm)": "4500 mm" }, fields), null);
  assert.equal(editorialMetricOf({ "Altura de elevación (mm)": "4500 mm" }, fields), 4.5);
  assert.equal(editorialMetricOf({ "Altura de elevación (mm)": "4500 kg" }, fields), null);
  assert.equal(editorialMetricOf({ "Altura de elevación (mm)": "4,5 m" }, fields), null);
  assert.equal(editorialMetricOf({ "Altura de elevación (m)": "4500 mm" }, ["Altura de elevación (m)"]), null);
  assert.equal(editorialMetricOf({}, fields), null);
});

test("la carga rechaza magnitudes contradictorias y no convierte toneladas implícitamente", () => {
  const fields = ["Capacidad de carga (kg)", "Capacidad"];
  assert.equal(editorialQuantityOf({ "Capacidad": "2500 kg", "Capacidad de carga (kg)": "2.500 kg" }, fields, "kg"), 2500);
  assert.equal(editorialQuantityOf({ "Capacidad": "2500 kg", "Capacidad de carga (kg)": "2200 kg" }, fields, "kg"), null);
  assert.equal(editorialQuantityOf({ "Capacidad": "2,5 t", "Capacidad de carga (kg)": "2500 kg" }, fields, "kg"), null);
  assert.equal(editorialQuantityOf({ "Capacidad": "2500 kg", "Capacidad de carga (kg)": "sin datos" }, fields, "kg"), null);
});

test("la misma coherencia se aplica a la carga documentada de tres proveedores", () => {
  for (const record of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const original = resolveEditorialFacts(record);
    assert.equal(original?.loadCapacityKg, 2500);
    const matching = withSpecs(record, { "Capacidad de carga": "2500 kg" });
    assert.equal(resolveEditorialFacts(matching)?.loadCapacityKg, 2500);
    const conflicting = withSpecs(record, { "Capacidad de carga": "3000 kg" });
    assert.equal(resolveEditorialFacts(conflicting), null);
    assert.equal(resolveReusableEditorial(conflicting).short, null);
    assert.equal(resolveReusableEditorial(conflicting).general, null);
  }
});

test("la elevación no se confunde con la altura de trabajo ni admite dos alturas incompatibles", () => {
  const gam = controlledGamForklift();
  assert.equal(resolveEditorialFacts(withSpecs(gam, { "Altura de elevación (m)": "4,5 m" }))?.liftingHeightM, 4.5);
  assert.equal(resolveEditorialFacts(withSpecs(gam, { "Altura de elevación (m)": "5 m" })), null);

  const gomariz = controlledGomarizForklift();
  assert.equal(resolveEditorialFacts(withSpecs(gomariz, { "Altura de elevación (mm)": "4500 mm" }))?.liftingHeightM, 4.5);
  assert.equal(resolveEditorialFacts(withSpecs(gomariz, { "Altura de elevación (mm)": "5500 mm" }))?.liftingHeightM, null);
});

test("los atributos secundarios contradictorios se omiten sin eliminar las medidas acreditadas", () => {
  const record = withSpecs(controlledGomarizForklift(), {
    "Voltaje de la batería": "48 V", "Voltaje": "80 V",
    "Tipo Mástil": "Tríplex"
  });
  const facts = resolveEditorialFacts(record);
  assert.equal(facts?.loadCapacityKg, 2500);
  assert.equal(facts?.voltageV, null);
  assert.equal(facts?.mastType, "tríplex");
  const text = resolveReusableEditorial(record).general ?? "";
  assert.doesNotMatch(text, /voltaje declarado/u);
  assert.match(text, /capacidad de carga de 2\.500 kg/u);
  const agreed = withSpecs(record, { "Voltaje": "48 V" });
  assert.equal(resolveEditorialFacts(agreed)?.voltageV, 48);
});

test("la selección de hechos no modifica el registro de origen", () => {
  const source = withSpecs(controlledMercaelevaForklift(), {
    "Capacidad de carga (kg)": "2700 kg"
  });
  const snapshot = JSON.stringify(source);
  assert.equal(resolveEditorialFacts(source), null);
  assert.equal(JSON.stringify(source), snapshot);
});

test("la altura documentada y la altura de trabajo conservan sus límites de interpretación", () => {
  const source = controlledMercaelevaForklift();
  const platform: ProductRecord = {
    ...source,
    title: "Plataforma de tijera eléctrica MARCA MODELO10",
    specs: {
      "Marca": "MARCA", "Modelo": "MODELO10", "Título adicional": "PLATAFORMA TIJERA ELECTRICA 10 MT",
      "Altura de trabajo": "12 m", "Tipo de motor": "Eléctrico"
    }
  };
  assert.equal(hasEditorialAdditionalHeightConflict(platform), true);
  assert.equal(hasEditorialAdapterHeightConflict(platform), false);
  assert.ok(resolveMercaelevaEditorialDomainSource(platform));

  const articulated = withSpecs({ ...platform, title: "Plataforma articulada eléctrica MARCA MODELO10" }, {
    "Título adicional": "PLATAFORMA ARTICULADA ELECTRICA 10 MT"
  });
  assert.equal(hasEditorialAdapterHeightConflict(articulated), true);
  assert.equal(resolveMercaelevaEditorialDomainSource(articulated), null);
  assert.equal(hasEditorialAdapterHeightConflict({ ...articulated, specs: { "Título adicional": "PLATAFORMA ARTICULADA ELECTRICA 10 MT" } }), true);
  assert.equal(hasEditorialSourceWorkHeightConflict(articulated), true);
  assert.equal(hasEditorialSourceWorkHeightConflict(withSpecs(articulated, { "Altura de trabajo": "10 m" })), false);
});

test("una afirmación textual de altura incompatible bloquea la evidencia narrativa, no otras magnitudes", () => {
  const source = controlledGomarizPlatform();
  const valid = { ...source, title: "Plataforma de tijera MARCA MODELO10", longDescription: "Altura de trabajo de 10 metros en la ficha." };
  assert.equal(hasEditorialSourceWorkHeightConflict(valid), false);
  assert.equal(hasEditorialSourceWorkHeightConflict({ ...valid, longDescription: "Altura de trabajo de 12 metros en la ficha." }), true);
  assert.equal(hasEditorialSourceWorkHeightConflict({ ...valid, title: "Altura de trabajo de 11 m MARCA MODELO10" }), true);
  assert.equal(hasEditorialSourceWorkHeightConflict({ ...valid, specs: { ...valid.specs, "Altura de trabajo": "10000 mm" } }), false);
});


test("la carga nominal reutiliza la misma regla sin propagar valores a otra unidad", () => {
  for (const record of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    assert.equal(resolveEditorialFacts(record)?.loadCapacityKg, 2500);
    assert.match(resolveReusableEditorial(record).short ?? "", /capacidad de carga de 2\.500 kg/u);
    const matching = withSpecs(record, { "Capacidad de carga": "2.500 kg" });
    assert.equal(resolveEditorialFacts(matching)?.loadCapacityKg, 2500);
    const contradicting = withSpecs(record, { "Capacidad de carga": "2.200 kg" });
    assert.equal(resolveEditorialFacts(contradicting)?.loadCapacityKg ?? null, null);
    assert.doesNotMatch(resolveReusableEditorial(contradicting).general ?? "", /capacidad de carga de 2\.500 kg/u);
    const otherUnit = { ...record, reference: `${record.reference}-OTRA`, specs: { ...record.specs, "Capacidad de carga": "1800 kg" } };
    assert.equal(resolveVerifiedTechnicalBrief(record, otherUnit), null);
    assert.equal(resolveEditorialFacts(record)?.loadCapacityKg, 2500);
  }
});

test("el peso de equipo solo se afirma cuando es una magnitud y unidad explícitas de la ficha", () => {
  for (const record of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source = withSpecs(record, { Peso: "3.750 kg", Longitud: "4,5 m" });
    const before = JSON.stringify(source);
    assert.equal(resolveEditorialFacts(source)?.weightKg, 3750);
    assert.match(resolveReusableEditorial(source).general ?? "", /peso declarado de 3\.750 kg/u);
    assert.match(resolveVerifiedTechnicalBrief(source, source) ?? "", /peso declarado de 3\.750 kg/u);
    assert.equal(resolveVerifiedTechnicalBrief(source, { ...source, reference: "OTRA-UNIDAD" }), null);
    for (const weight of ["3.750 m", "3,75 t", "3.750 kg o 4.000 kg"]) {
      const incompatible = withSpecs(source, { Peso: weight });
      assert.equal(resolveEditorialFacts(incompatible)?.weightKg, null);
      assert.doesNotMatch(resolveReusableEditorial(incompatible).general ?? "", /peso declarado/u);
      assert.equal(resolveEditorialFacts(incompatible)?.loadCapacityKg, 2500);
    }
    assert.equal(JSON.stringify(source), before);
  }
});

test("las conversiones explícitas respetan magnitud y concepto sin suponer equivalencias", () => {
  const aliases = ["Altura máxima de elevación", "Altura de elevación (mm)"];
  assert.equal(editorialMetricOf({ "Altura máxima de elevación": "4,5 m", "Altura de elevación (mm)": "4500 mm" }, aliases), 4.5);
  assert.equal(editorialMetricOf({ "Altura máxima de elevación": "4,5 m", "Altura de elevación (mm)": "4501 mm" }, aliases), null);
  assert.equal(editorialMetricOf({ "Altura máxima de elevación": "4,5 m", "Altura de elevación (mm)": "4,5 m" }, aliases), null);
  assert.equal(editorialQuantity("2.500 kg", "kg"), 2500);
  assert.equal(editorialQuantity("2,5 t", "kg"), null);
  assert.equal(editorialQuantity("2500 kg", "t"), null);
  assert.equal(editorialQuantity("2500 kg", "m"), null);
  assert.equal(editorialQuantityOf({ "Capacidad": "2500 kg", "Capacidad de carga (kg)": "2,5 t" },
    ["Capacidad", "Capacidad de carga (kg)"], "kg"), null);
  assert.equal(editorialMetricOf({ "Altura de trabajo": "10 m" }, ["Altura plataforma"]), null);
});

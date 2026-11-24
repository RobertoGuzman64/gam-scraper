import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { resolveEditorialFacts } from "./editorial-facts.js";
import { resolveReusableEditorial } from "./editorial-composition.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift,
  controlledGomarizPlatform, controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

test("el mismo contrato de carretilla funciona en tres proveedores sin identificadores reales", () => {
  const sources = [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()];
  for (const source of sources) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "carretilla-elevadora", source.providerId);
    assert.equal(facts?.loadCapacityKg, 2500, source.providerId);
    assert.match(resolveReusableEditorial(source).short ?? "", /capacidad de carga de 2\.500 kg/u);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("alturas de trabajo y elevación no se mezclan", () => {
  const work = resolveEditorialFacts(controlledGomarizPlatform());
  const lifting = resolveEditorialFacts(controlledGamForklift());
  assert.equal(work?.workingHeightM, 10);
  assert.equal(work?.liftingHeightM, null);
  assert.equal(lifting?.workingHeightM, null);
  assert.equal(lifting?.liftingHeightM, 4.5);
  assert.doesNotMatch(resolveReusableEditorial(controlledGomarizPlatform()).short ?? "", /altura de elevación/u);
  assert.doesNotMatch(resolveReusableEditorial(controlledGamForklift()).short ?? "", /altura de trabajo/u);
});

test("dos proveedores con la misma familia no comparten datos ausentes de la otra fuente", () => {
  const complete = controlledGomarizPlatform();
  const partial = controlledMercaelevaPlatform();
  assert.equal(resolveEditorialFacts(complete)?.family, "plataforma-tijera");
  assert.equal(resolveEditorialFacts(partial)?.family, "plataforma-tijera");
  assert.match(resolveReusableEditorial(complete).short ?? "", /capacidad de 450 kg/u);
  assert.doesNotMatch(resolveReusableEditorial(partial).short ?? "", /450 kg/u);
});

test("las fuentes incompatibles no propagan texto a otras variantes", () => {
  const source = controlledGamForklift();
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, model: "MODELO99" },
    { ...source, url: "https://example.invalid/es/carretillas/CONTROL-03-carretilla-elevadora" },
    { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "2500 litros" } },
    { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "3500 kg" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveEditorialFacts(variant), null, String(index));
    assert.deepEqual(resolveReusableEditorial(variant), { short: null, general: null });
  }
});

test("las cotas replegadas y de plataforma se interpretan con los alias de la misma unidad", () => {
  const gomariz = controlledGomarizPlatform();
  const mercaeleva = controlledMercaelevaPlatform();
  const manain: ProductRecord = {
    ...gomariz, providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
    title: "MODELO10", url: "https://manain.com/producto/venta-elevacion-tijera-marca-modelo10/",
    specs: { Marca: "MARCA", Modelo: "MODELO10", "Nueva o usada": "usada", Motor: "Eléctrico",
      "Altura trabajo": "10 m", "Capacidad carga": "450 kg" }
  };
  const cases: readonly (readonly [ProductRecord, NonNullable<ProductRecord["specs"]>])[] = [
    [gomariz, { "Longitud de plataforma": "2 m", "Anchura de plataforma": "800 mm" }],
    [mercaeleva, { "Longitud de plataforma": "2 m", "Anchura de plataforma": "800 mm" }],
    [manain, { "Longitud plataforma": "2 m", "Ancho plataforma": "800 mm" }]
  ];
  for (const [source, dimensions] of cases) {
    const record: ProductRecord = { ...source, specs: { ...source.specs, ...dimensions,
      "Altura replegada": "2,1 m", "Longitud total": "2,5 m", "Anchura total": "1 m" } };
    const before = JSON.stringify(record);
    const facts = resolveEditorialFacts(record);
    assert.equal(facts?.storedHeightM, 2.1, source.providerId);
    assert.equal(facts?.basketLengthM, 2, source.providerId);
    assert.equal(facts?.basketWidthM, 0.8, source.providerId);
    assert.match(resolveReusableEditorial(record).general ?? "", /altura replegada de 2,1 m.*plataforma de 2 × 0,8 m/u);
    assert.equal(JSON.stringify(record), before);
  }
});

test("las cotas nuevas no se narran con dimensiones incompatibles ni con evidencia de otra unidad", () => {
  const source = controlledGomarizPlatform();
  const record: ProductRecord = { ...source, specs: { ...source.specs,
    "Altura replegada": "2 m", "Longitud de plataforma": "2 m", "Anchura de plataforma": "0,8 m",
    "Longitud total": "2,5 m", "Anchura total": "1 m" } };
  const variants: readonly NonNullable<ProductRecord["specs"]>[] = [
    { "Anchura de plataforma": "3 m" },
    { "Longitud de plataforma": "4 m" },
    { "Anchura de plataforma": "0,8 kg" },
    { "Ancho plataforma": "0,9 m" },
    { "Dimensiones Cesta": "2 × 0,9 m" },
    { "Anchura de plataforma": "0,8 / 1 m" }
  ];
  for (const variant of variants) {
    const conflicting = { ...record, specs: { ...record.specs, ...variant } };
    assert.equal(resolveEditorialFacts(conflicting)?.basketLengthM, null);
    assert.equal(resolveEditorialFacts(conflicting)?.basketWidthM, null);
    assert.doesNotMatch(resolveReusableEditorial(conflicting).general ?? "", /plataforma de \d.*×/u);
  }
  const heightConflicts: readonly NonNullable<ProductRecord["specs"]>[] = [
    { "Altura replegada": "12 m" }, { "Altura almacenaje": "3 m" }, { "Altura replegada": "2 kg" }
  ];
  for (const specs of heightConflicts) {
    const conflicting = { ...record, specs: { ...record.specs, ...specs } };
    assert.equal(resolveEditorialFacts(conflicting)?.storedHeightM, null);
    assert.doesNotMatch(resolveReusableEditorial(conflicting).general ?? "", /altura replegada/u);
  }
  for (const original of [source, { ...record, reference: "CONTROL-OTRA" },
    { ...record, specs: { ...record.specs, "Altura replegada": "2,2 m", "Anchura de plataforma": "0,9 m" } }]) {
    const general = resolveReusableEditorial(record, null, original).general ?? "";
    assert.doesNotMatch(general, /altura replegada|plataforma de \d.*×/u);
  }
  const forklift = controlledGamForklift();
  const handling = { ...forklift, specs: { ...forklift.specs, "Altura replegada": "2 m",
    "Longitud de plataforma": "2 m", "Anchura de plataforma": "0,8 m" } };
  assert.equal(resolveEditorialFacts(handling)?.basketLengthM, null);
  assert.equal(resolveEditorialFacts(handling)?.storedHeightM, null);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";

const articulated = accreditedSourceRecord("gomariz-original", "BA1253");
const telescopic = accreditedSourceRecord("gomariz-original", "BT1102");
const firstBasket = accreditedSourceRecord("gam-original", "6901");
const secondBasket = accreditedSourceRecord("gam-original", "6984");

const newUnit = (source: ProductRecord, specs: NonNullable<ProductRecord["specs"]>): ProductRecord => {
  const reference = `${source.reference}-OTRA`;
  const url = source.providerId === "gam" ? source.url?.replace(`/${source.reference}-`, `/${reference}-`) :
    source.url?.replace(/\/$/u, "-otra-unidad/");
  return {
    ...source, reference, url: url ?? null, year: null, horometer: null, serialNumber: null,
    shortDescription: null, longDescription: null, specs: { ...source.specs, ...specs }
  };
};

test("RE012 acredita alcance lateral de articuladas y telescópicas históricas sin confundir altura", () => {
  for (const [source, reach] of [[articulated, 12.19], [telescopic, 24.38]] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.ok(facts?.family === "plataforma-articulada" || facts?.family === "plataforma-telescopica");
    assert.equal(facts.lateralReachM, reach);
    assert.notEqual(facts.lateralReachM, facts.workingHeightM);
    const claim = `alcance lateral de ${String(reach).replace(".", ",")} m`;
    assert.ok(resolveReusableEditorial(source).short?.includes(claim));
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.ok(prepared.product.description_general?.includes(claim));
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE012 reutiliza la medida propia en otras unidades sin heredar el alcance anterior", () => {
  for (const [source, reach, previous] of [
    [articulated, "13.4 m", "12,19"],
    [telescopic, "23.5 m", "24,38"]
  ] as const) {
    const unit = newUnit(source, { "Alcance lateral": reach });
    const current = reach.replace(".", ",");
    assert.equal(resolveEditorialFacts(unit)?.lateralReachM, Number.parseFloat(reach));
    const prepared = prepareSourceProduct(unit);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.reference, unit.reference);
    assert.equal(prepared.product.sourceUrl, unit.url);
    assert.ok(prepared.product.description_general?.includes(`alcance lateral de ${current}`));
    assert.ok(!prepared.product.description_general?.includes(`alcance lateral de ${previous} m`));
    const missing = { ...unit, specs: { ...unit.specs } };
    delete missing.specs["Alcance lateral"];
    assert.equal(resolveEditorialFacts(missing)?.lateralReachM, null);
    assert.doesNotMatch(resolveReusableEditorial(missing).general ?? "", /alcance lateral de /u);
  }
});

test("RE012 descarta alcance ambiguo, unidades incompatibles y procedencia o familia ajenas", () => {
  for (const value of ["12.19 kg", "12,19 m o 13 m", "12000", "90 m"]) {
    const invalid = { ...articulated, specs: { ...articulated.specs, "Alcance lateral": value } };
    assert.equal(resolveEditorialFacts(invalid)?.lateralReachM ?? null, null);
    assert.doesNotMatch(resolveReusableEditorial(invalid).general ?? "", /alcance lateral de /u);
  }
  const conflicting = { ...articulated, specs: { ...articulated.specs, "Alcance Lateral": "8 m" } };
  assert.equal(resolveEditorialFacts(conflicting), null);
  for (const invalid of [
    { ...articulated, providerId: "gam" },
    { ...articulated, url: "https://example.invalid/venta/plataforma/" },
    { ...articulated, brand: "OTRA" },
    { ...articulated, model: "OTRO-MODELO" },
    { ...articulated, condition: "Nuevo" as const }
  ]) assert.equal(resolveEditorialFacts(invalid), null);
  const scissor = accreditedSourceRecord("gomariz-original", "TE1618");
  const wrongFamily = { ...scissor, specs: { ...scissor.specs, "Alcance lateral": "12 m" } };
  assert.equal(resolveEditorialFacts(wrongFamily)?.lateralReachM ?? null, null);
});

test("RE035 conserva dimensiones reales de cesta de unidades GAM distintas", () => {
  for (const [source, length, width, claim] of [
    [firstBasket, 1.83, 1, "cesta de 1,83 × 1 m"],
    [secondBasket, 1.8, 0.76, "cesta de 1,8 × 0,76 m"]
  ] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "plataforma-articulada");
    assert.equal(facts.basketLengthM, length);
    assert.equal(facts.basketWidthM, width);
    assert.ok(resolveReusableEditorial(source).general?.includes(claim));
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.ok(prepared.product.description_general?.includes(claim));
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE035 reutiliza dimensiones de cesta propias y descarta formatos no corroborables", () => {
  const unit = newUnit(firstBasket, { "Dimensiones Cesta": "2,1 x 1,1 metros" });
  const prepared = prepareSourceProduct(unit);
  assert.deepEqual([resolveEditorialFacts(unit)?.basketLengthM, resolveEditorialFacts(unit)?.basketWidthM], [2.1, 1.1]);
  assert.equal(prepared.status, "ready");
  assert.ok(prepared.product.description_general?.includes("cesta de 2,1 × 1,1 m"));
  assert.doesNotMatch(resolveReusableEditorial(unit).general ?? "", /cesta de 1,83 × 1 m/u);
  const noBasket = { ...unit, specs: { ...unit.specs } };
  delete noBasket.specs["Dimensiones Cesta"];
  assert.equal(resolveEditorialFacts(noBasket)?.basketLengthM ?? null, null);
  assert.doesNotMatch(resolveReusableEditorial(noBasket).general ?? "", /cesta de /u);
  for (const value of ["2100 x 1100 mm", "2,1 x 1,1 kg", "2,1 x 1,1 x 0,8 metros", "2,1 x 1,1 metros o 2 x 1 metros", "20 x 1 metros"]) {
    const invalid = { ...firstBasket, specs: { ...firstBasket.specs, "Dimensiones Cesta": value } };
    assert.equal(resolveEditorialFacts(invalid)?.basketLengthM ?? null, null);
    assert.doesNotMatch(resolveReusableEditorial(invalid).general ?? "", /cesta de /u);
  }
  for (const invalid of [
    { ...firstBasket, providerId: "gomariz" },
    { ...firstBasket, url: "https://example.invalid/plataforma" },
    { ...firstBasket, brand: "OTRA" },
    { ...firstBasket, model: "OTRO" },
    { ...firstBasket, reference: "OTRA" }
  ]) assert.equal(resolveEditorialFacts(invalid), null);
  const forklift = accreditedSourceRecord("gam-original", "6755");
  const wrongFamily = { ...forklift, specs: { ...forklift.specs, "Dimensiones Cesta": "2 x 1 metros" } };
  assert.equal(resolveEditorialFacts(wrongFamily)?.basketLengthM ?? null, null);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledGomarizPlatform, controlledMercaelevaForklift, controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

test("las máquinas con conceptos equivalentes comparten el dominio, no los textos de unidad", () => {
  const first = controlledGomarizPlatform();
  const second = controlledMercaelevaPlatform();
  assert.equal(resolveEditorialFacts(first)?.workingHeightM, 10);
  assert.equal(resolveEditorialFacts(second)?.workingHeightM, 10);
  assert.equal(resolveReusableEditorial(first).short?.includes("10 m"), true);
  assert.equal(resolveReusableEditorial(second).short?.includes("10 m"), true);
  assert.doesNotMatch(resolveReusableEditorial(second).general ?? "", /450 kg/u);
});

test("los horómetros pertenecen a cada unidad y no al modelo compartido", () => {
  const source = controlledGamForklift();
  const withHours = { ...source, horometer: "1616 horas" };
  const another = { ...source, reference: "CONTROL-OTRA", url: "https://online.gamrentals.com/es/carretillas/CONTROL-OTRA-carretilla-elevadora", horometer: "500 horas" };
  assert.equal(resolveReusableEditorial(withHours).short, resolveReusableEditorial(another).short);
  assert.match(resolveReusableEditorial(withHours).general ?? "", /1\.616 horas/u);
  assert.match(resolveReusableEditorial(another).general ?? "", /500 horas/u);
  assert.doesNotMatch(resolveReusableEditorial(another).general ?? "", /1\.616 horas/u);
});

test("las variantes semánticas incompatibles no atraviesan el motor", () => {
  const source = controlledGomarizPlatform();
  for (const record of [
    { ...source, providerId: "mercaeleva" },
    { ...source, model: "OTRA-VARIANTE" },
    { ...source, url: "https://example.invalid/producto/marca-modelo10/" },
    { ...source, specs: { ...source.specs, "Altura de trabajo": "10 kg" } }
  ]) {
    assert.equal(resolveEditorialFacts(record), null);
    assert.deepEqual(resolveReusableEditorial(record), { short: null, general: null });
  }
});

test("la preparación no altera identidad o datos de origen", () => {
  const source = controlledGamForklift();
  const initial = JSON.stringify(source);
  const result = prepareSourceProduct(source);
  assert.equal(result.product.reference, source.reference);
  assert.equal(result.product.sourceUrl, source.url);
  assert.equal(JSON.stringify(source), initial);
});


test("año y horómetro se conservan solo en la unidad acreditada, con exclusiones comunes", () => {
  const sources = [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()];
  for (const source of sources) {
    const original = JSON.stringify(source);
    const first = { ...source, year: "2019", horometer: "2845 horas" };
    const second: ProductRecord = {
      ...source,
      reference: "CONTROL-ALT",
      url: source.providerId === "gomariz" ?
        source.url.replace("/producto/marca-modelo10/", "/producto/marca-modelo10-alternativa/") :
        source.url.replace(source.reference ?? "", "CONTROL-ALT"),
      year: "2021",
      horometer: "610 horas"
    };
    const generalFirst = resolveReusableEditorial(first).general ?? "";
    const generalSecond = resolveReusableEditorial(second).general ?? "";
    assert.equal(resolveEditorialFacts(first)?.year, 2019, source.providerId);
    assert.equal(resolveEditorialFacts(first)?.hours, 2845, source.providerId);
    assert.match(generalFirst, /año de fabricación 2019 y 2\.845 horas registradas/u, source.providerId);
    assert.match(generalSecond, /año de fabricación 2021 y 610 horas registradas/u, source.providerId);
    assert.doesNotMatch(generalSecond, /2\.845 horas|2019/u, source.providerId);
    assert.doesNotMatch(resolveReusableEditorial(source).general ?? "", /horas registradas|año de fabricación/u, source.providerId);
    const unverified = { ...source, year: "2099", horometer: "200001 horas" };
    assert.equal(resolveEditorialFacts(unverified)?.year, null, source.providerId);
    assert.equal(resolveEditorialFacts(unverified)?.hours, null, source.providerId);
    assert.doesNotMatch(resolveReusableEditorial(unverified).general ?? "", /2099|200001 horas/u, source.providerId);
    assert.equal(JSON.stringify(source), original, source.providerId);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { controlledGamForklift, controlledGomarizPlatform } from "./editorial-contract-records.js";

test("las máquinas nuevas equivalentes reciben el resumen de familia sin una regla por referencia", () => {
  const source = controlledGomarizPlatform();
  const next = { ...source, reference: "CONTROL-OTRA", url: "https://www.gomarizrent.com/producto/otra-marca-modelo10/" };
  const original = JSON.stringify([source, next]);
  assert.equal(resolveReusableEditorial(source).short, resolveReusableEditorial(next).short);
  assert.equal(prepareSourceProduct(source).product.description, prepareSourceProduct(next).product.description);
  assert.equal(JSON.stringify([source, next]), original);
});

test("la familia de manutención no transforma la elevación en altura de trabajo", () => {
  const source = controlledGamForklift();
  const facts = resolveEditorialFacts(source);
  assert.equal(facts?.family, "carretilla-elevadora");
  assert.equal(facts?.workingHeightM, null);
  assert.equal(facts?.liftingHeightM, 4.5);
  assert.match(resolveReusableEditorial(source).short ?? "", /altura de elevación de 4,5 m/u);
});

test("una ficha sin evidencia técnica no se declara preparada por rellenar texto", () => {
  const source = controlledGomarizPlatform();
  const result = prepareSourceProduct({ ...source, specs: {} });
  assert.equal(result.status, "review");
  assert.ok(result.issues.some((issue) => issue.includes("Cobertura editorial insuficiente")));
});

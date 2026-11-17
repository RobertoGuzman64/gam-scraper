import assert from "node:assert/strict";
import test from "node:test";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { normalizeEditorialSummary } from "../domain/editorial-normalization.js";
import { removeSourcedSaleWording } from "../domain/editorial-source-brief.js";

const source = (reference: string): ProductRecord => accreditedSourceRecord("gam-original", reference);
const quantities = (value: string): ReadonlySet<string> => new Set(value.match(/\d+(?:[.,]\d+)*/gu) ?? []);

test("la corta técnica conserva todas las cifras al retirar el encuadre comercial", () => {
  for (const reference of ["6492", "4845", "6166", "6185"] as const) {
    const record = source(reference);
    const before = normalizeEditorialSummary(record.shortDescription, record.model);
    const result = removeSourcedSaleWording(record, before);
    assert.ok(result, reference);
    assert.doesNotMatch(result, /\bVenta de\b/iu);
    assert.match(result, /\. Plataforma\b/iu);
    for (const value of quantities(before ?? "")) assert.ok(quantities(result).has(value), `${reference}: ${value}`);
    assert.equal(prepareSourceProduct(record).product.description, result);
  }
});

test("la limpieza comercial rechaza variantes, proveedores y modificaciones de la fuente", () => {
  const record = source("4845");
  const before = normalizeEditorialSummary(record.shortDescription, record.model);
  assert.ok(before);
  for (const changed of [
    { ...record, providerId: "gomariz" },
    { ...record, model: "B-LIFT 18HD" },
    { ...record, brand: "OTRA MARCA" },
    { ...record, title: "Otra máquina" },
    { ...record, specs: { ...record.specs, Modelo: "OTRO MODELO" } }
  ] satisfies ProductRecord[]) {
    assert.equal(removeSourcedSaleWording(changed, before), null);
  }
  assert.equal(removeSourcedSaleWording(record, before.replace("360", "300")), null);
  assert.equal(removeSourcedSaleWording({ ...record, shortDescription: null }, before), null);
});

test("las cortas truncadas se resuelven con la identidad y las discrepancias del original", () => {
  const hybrid = source("4778");
  const fuel = source("12");
  const hybridResult = prepareSourceProduct(hybrid);
  const fuelResult = prepareSourceProduct(fuel);
  assert.match(hybridResult.product.description ?? "", /320 kg/u);
  assert.match(hybridResult.product.description ?? "", /cifra distinta/u);
  assert.doesNotMatch(hybridResult.product.description ?? "", /rotaci[oó]n de torreta de 35/u);
  assert.match(fuelResult.product.description ?? "", /4\.000 kg/u);
  assert.match(fuelResult.product.description ?? "", /di[eé]sel o GLP/u);
  assert.match(fuelResult.product.description ?? "", /deben confirmarse/u);
  assert.equal(hybridResult.product.title, prepareSourceProduct(hybrid).product.title);
  assert.equal(fuelResult.product.title, prepareSourceProduct(fuel).product.title);
});

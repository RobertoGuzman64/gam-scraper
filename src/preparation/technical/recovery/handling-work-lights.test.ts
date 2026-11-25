import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { controlledGamForklift } from "../../editorial/core/editorial-contract-records.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { recoverSourceHandlingConfiguration } from "./handling-family-specifications.js";

const field = "Luces de trabajo";
const source = (claim: string): ProductRecord => ({
  ...controlledGamForklift(), reference: "123456789", condition: "Nuevo", categoryKey: "carretillas-nuevas",
  categoryName: "Carretilla elevadora", title: "Carretilla elevadora eléctrica MARCA MODELO10",
  url: "https://online.gamrentals.com/es/carretillas/123456789-marca-modelo10",
  shortDescription: "Carretilla MARCA MODELO10", longDescription: `La carretilla MARCA MODELO10 es eléctrica. ${claim}`,
  specs: { Marca: "MARCA", Modelo: "MODELO10", "Capacidad de carga (kg)": "2500 kg" }
});
const recover = (record: ProductRecord) => recoverSourceHandlingConfiguration(record, record, record.specs ?? {});

test("recupera las luces de trabajo declaradas sin inferir tecnología ni montaje", () => {
  for (const claim of ["Incorpora luces de trabajo.", "Se han incorporado características de seguridad, como luces de trabajo.",
    "Está equipada con luces de trabajo."]) {
    const record = source(claim);
    const snapshot = structuredClone(record);
    const result = recover(record);
    assert.deepEqual(result, { ...record.specs, [field]: true });
    assert.equal(recoverSourceHandlingConfiguration(record, record, result), result);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec[field], true);
    const evidence = prepared.technicalProvenance?.entries.find((entry) => entry.field === field);
    assert.equal(evidence?.scope, "unit");
    assert.equal(evidence?.sourceField, "longDescription");
    assert.equal(evidence?.sourceValue, record.longDescription);
    assert.deepEqual(record, snapshot);
    const other: ProductRecord = { ...record, providerId: "mercaeleva", reference: "CONTROL-02", categoryKey: "venta",
      url: "https://sales.mercaeleva.com/es/for-sale/machine/MARCA-MODELO10-CONTROL-02" };
    assert.equal(recover(other)[field], true);
  }
});

test("rechaza iluminación opcional, negada, no atribuible o ya declarada", () => {
  for (const claim of ["Puede incorporar luces de trabajo.", "Incorpora luces de trabajo opcionales.",
    "No incorpora luces de trabajo.", "Otros modelos incorporan luces de trabajo.",
    "La MARCA MODELO20 incorpora luces de trabajo.", "Incorpora luces de trabajo. Carece de luces de trabajo.",
    "Luces de trabajo disponibles.", "Incorpora luces de trabajo desactivadas.", "La variante LWB incorpora luces de trabajo."]) {
    const record = source(claim);
    assert.equal(recover(record), record.specs, claim);
  }
  const record = source("Incorpora luces de trabajo.");
  for (const invalid of [
    { ...record, condition: "Segunda mano" as const },
    { ...record, shortDescription: "MARCA MODELO20" },
    { ...record, url: record.url.replace("modelo10", "modelo20") },
    { ...record, specs: { ...record.specs, [field]: false } },
    { ...record, specs: { ...record.specs, Iluminación: "No instalada" } }
  ]) assert.equal(recover(invalid), invalid.specs);
  assert.equal(recoverSourceHandlingConfiguration(record, { ...record, longDescription: "Otro texto" }, record.specs ?? {}), record.specs);
  assert.equal(recoverSourceHandlingConfiguration(record, { ...record, reference: "OTRA" }, record.specs ?? {}), record.specs);
});

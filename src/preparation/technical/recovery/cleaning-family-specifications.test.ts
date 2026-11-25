import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { controlledGamForklift } from "../../editorial/core/editorial-contract-records.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { recoverSourceCleaningConfiguration } from "./cleaning-family-specifications.js";

const record: ProductRecord = {
  ...controlledGamForklift(), reference: "123456789", condition: "Nuevo", categoryKey: "limpieza-fregadoras", categoryName: "Fregadoras",
  url: "https://online.gamrentals.com/es/fregadoras/123456789-marca-modelo10",
  title: "Fregadora MARCA MODELO10", longDescription: "La fregadora MARCA MODELO10 es una máquina de conductor sentado.",
  specs: { Marca: "MARCA", Modelo: "MODELO10" }
};
const recover = (source: ProductRecord) => recoverSourceCleaningConfiguration(source, source, source.specs ?? {});

test("recupera el tipo de conductor acreditado sin duplicar ni mutar el original", () => {
  const snapshot = structuredClone(record);
  const output = recover(record);
  assert.equal(output["Tipo de conductor"], "Hombre a bordo");
  assert.equal(recoverSourceCleaningConfiguration(record, record, output), output);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec["Tipo de conductor"], "Hombre a bordo");
  const trace = prepared.technicalProvenance?.entries.find((entry) => entry.field === "Tipo de conductor");
  assert.equal(trace?.scope, "unit");
  assert.equal(trace?.sourceField, "longDescription");
  assert.deepEqual(record, snapshot);
});

test("reutiliza la recuperación en otra familia de limpieza y otro proveedor compatible", () => {
  const walking: ProductRecord = { ...record, providerId: "mercaeleva", categoryKey: "venta", categoryName: "Maquinaria en venta",
    reference: "CONTROL-04", url: "https://sales.mercaeleva.com/es/for-sale/machine/MARCA-MODELO10-CONTROL-04",
    title: "Barredora MARCA MODELO10", longDescription: "La barredora MARCA MODELO10 es una máquina de conductor acompañante." };
  assert.equal(recover(walking)["Tipo de conductor"], "Hombre a pie");
});

test("excluye opciones, otras unidades, identidades incompatibles, contradicciones y duplicados", () => {
  for (const invalid of [
    { ...record, longDescription: "La fregadora MARCA MODELO10 no es una máquina de conductor sentado." },
    { ...record, longDescription: "La fregadora MARCA MODELO10 puede configurarse como opción como máquina de conductor sentado." },
    { ...record, longDescription: "La fregadora MARCA MODELO11 es una máquina de conductor sentado." },
    { ...record, longDescription: "La fregadora MARCA MODELO10 admite comparación con una máquina de conductor sentado." },
    { ...record, shortDescription: "Fregadora de conductor acompañante." },
    { ...record, title: "Fregadora autónoma MARCA MODELO10" },
    { ...record, condition: "Segunda mano" as const },
    { ...record, specs: { ...record.specs, "Posición de conducción": "Operador a pie" } }
  ]) assert.equal(recover(invalid), invalid.specs);
  assert.equal(recoverSourceCleaningConfiguration(record, { ...record, reference: "OTRA" }, record.specs ?? {}), record.specs);
});

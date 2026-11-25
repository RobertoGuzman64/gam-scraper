import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { controlledGamForklift, controlledGomarizPlatform } from "../editorial/core/editorial-contract-records.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { recoverReviewedModelTechnicalSpecs } from "./documented-technical-evidence.js";

const field = "Paso de almacenamiento de bandejas";
const offer = (): ProductRecord => ({
  ...controlledGamForklift(), condition: "Nuevo", brand: "MODULA", model: "MC25D",
  categoryName: "Almacén automático vertical", categoryKey: "almacenamiento",
  title: "Almacén automático vertical MODULA MC25D",
  shortDescription: "MODULA MC25D nuevo", longDescription: "El MODULA MC25D es un almacén automático vertical.",
  url: "https://online.gamrentals.com/es/modula/CONTROL-03-modula-mc25d",
  specs: { Marca: "MODULA", Modelo: "MC25D", Altura: "2500 mm" }
});
const recover = (record: ProductRecord) => recoverReviewedModelTechnicalSpecs(record, record.specs ?? {});

test("incorpora el paso de posicionamiento acreditado sin inferir alturas ni separaciones fijas", () => {
  const record = offer();
  const before = structuredClone(record);
  const result = recover(record);
  assert.deepEqual(result, { ...record.specs, [field]: "25 mm" });
  assert.deepEqual(record, before);
  assert.equal(recoverReviewedModelTechnicalSpecs(record, result), result);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.spec[field], "25 mm");
  const entry = prepared.technicalProvenance?.entries.find((item) => item.field === field);
  assert.equal(entry?.scope, "model-document");
  assert.equal(entry?.verification?.kind, "reviewed-model-fact");
  assert.match(entry?.verification?.support ?? "", /página 3/u);
});

test("reutiliza la acreditación con otra referencia y proveedor y exige corroboración si marca y modelo están unidos", () => {
  const record = offer();
  const alternative = controlledGomarizPlatform();
  assert.equal(recover({ ...record, providerId: alternative.providerId, reference: alternative.reference,
    url: "https://www.gomarizrent.com/producto/modula-mc25d/" })[field], "25 mm");
  assert.equal(recover({ ...record, shortDescription: "MODULAMC25D nuevo" })[field], "25 mm");
  const invalid = { ...record, shortDescription: "MODULAMC25D nuevo", longDescription: "El MODULA MC50D es un almacén automático vertical." };
  assert.equal(recover(invalid), invalid.specs);
});

test("protege las variantes, los datos existentes y las identidades no acreditadas", () => {
  const record = offer();
  for (const invalid of [
    { ...record, condition: "Segunda mano" as const }, { ...record, year: "2020" },
    { ...record, serialNumber: "CONTROL-SERIAL" }, { ...record, url: record.url.replace("mc25d", "mc25dd") },
    { ...record, model: "MC25DD" }, { ...record, shortDescription: "MODULA MC25DD nuevo" },
    { ...record, longDescription: `${record.longDescription} Paso de almacenamiento de 50 mm.` },
    { ...record, specs: { ...record.specs, "Paso de almacenamiento de bandejas": "50 mm" } }
  ]) assert.equal(recover(invalid), invalid.specs);
  const existing = { ...record.specs, "Separación entre bandejas": "50 mm" };
  assert.equal(recoverReviewedModelTechnicalSpecs(record, existing), existing);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGamCorroboratedSummaryCapacity } from "../../reconciliation/gam-source-summary-capacity.js";

const source = (reference: string): ProductRecord => accreditedSourceRecord("gam-original", reference);

test("GAM: una capacidad de resumen se reconcilia solo con título, modelo, URL, ficha y texto extenso concordantes", () => {
  for (const reference of ["2089", "6272", "6574", "6915"]) {
    const record = source(reference);
    const before = JSON.stringify(record);
    const corrected = reconcileGamCorroboratedSummaryCapacity(record);
    assert.notEqual(corrected, record, reference);
    assert.equal(corrected.url, record.url);
    assert.equal(corrected.title, record.title);
    assert.deepEqual(corrected.specs, record.specs);
    assert.equal(corrected.longDescription, record.longDescription);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.issues, [], reference);
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.ok(prepared.product.description?.includes(record.model ?? ""), reference);
    assert.ok(prepared.product.description_general?.includes(record.model ?? ""), reference);
    assert.equal(JSON.stringify(record), before);
  }
});

test("GAM: se conserva el resumen si la identidad es correcta y solo la capacidad fue mal publicada", () => {
  const record = source("2089");
  const corrected = reconcileGamCorroboratedSummaryCapacity(record);
  assert.equal(corrected.shortDescription, record.shortDescription?.replace("5500 kg", "5000 kg"));
  assert.equal(corrected.shortDescription?.includes("5500 kg"), false);
  assert.match(prepareSourceProduct(record).product.description ?? "", /5000 kg/u);
  const heavyRecord = source("6272");
  const heavyCorrected = reconcileGamCorroboratedSummaryCapacity(heavyRecord);
  assert.equal(heavyCorrected.shortDescription, heavyRecord.shortDescription?.replace("12000 kg", "12500 kg"));
  assert.equal(prepareSourceProduct(heavyRecord).status, "ready");
});

test("GAM: no se reutilizan encabezamientos y prestaciones de otra máquina en el resumen", () => {
  for (const [reference, wrongModel] of [["6574", "RO1.6"], ["6915", "D25G"]] as const) {
    const record = source(reference);
    const corrected = reconcileGamCorroboratedSummaryCapacity(record);
    assert.equal(corrected.shortDescription, null);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready");
    assert.doesNotMatch(prepared.product.description ?? "", new RegExp(wrongModel.replace(".", "\\."), "u"));
    assert.doesNotMatch(prepared.product.description_general ?? "", new RegExp(wrongModel.replace(".", "\\."), "u"));
  }
});

test("GAM: la ausencia de corroboración o una segunda capacidad incompatible impiden reconciliar", () => {
  const record = source("2089");
  const incompatible: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, url: "https://example.invalid/es/hyster/2089-h50ft" },
    { ...record, url: `${record.url}?variante=otra` },
    { ...record, reference: "2089-OTRA" },
    { ...record, brand: "YALE" },
    { ...record, model: "H5.5FT" },
    { ...record, title: "Carretilla elevadora diésel 5500Kg Hyster H5.0FT" },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "5500 KG" } },
    { ...record, specs: { ...record.specs, Modelo: "H5.5FT" } },
    { ...record, shortDescription: null },
    { ...record, shortDescription: `${record.shortDescription} Capacidad de carga de 4500 kg` },
    { ...record, longDescription: (record.longDescription ?? "").replace("5.000 kg", "5.500 kg") },
    { ...record, longDescription: `${record.longDescription} Capacidad nominal de 5500 kg.` },
    { ...record, longDescription: "La carretilla Hyster H5.0FT se destina a manutención pesada." }
  ];
  for (const candidate of incompatible) {
    assert.equal(reconcileGamCorroboratedSummaryCapacity(candidate), candidate);
  }
  assert.equal(prepareSourceProduct(incompatible[6]!).status, "review");
});

test("GAM: no se borra un resumen cruzado si el otro modelo también figura en el origen confirmado", () => {
  const record = source("6574");
  const incompatible = { ...record, longDescription: `${record.longDescription} También se identifica el RO1.6.` };
  assert.equal(reconcileGamCorroboratedSummaryCapacity(incompatible), incompatible);
  assert.equal(prepareSourceProduct(incompatible).status, "review");
});

test("GAM: las capacidades e identidades realmente contradictorias permanecen en review", () => {
  for (const reference of ["6934", "4739"]) {
    const record = source(reference);
    assert.equal(reconcileGamCorroboratedSummaryCapacity(record), record, reference);
    assert.equal(prepareSourceProduct(record).status, "review", reference);
  }
});

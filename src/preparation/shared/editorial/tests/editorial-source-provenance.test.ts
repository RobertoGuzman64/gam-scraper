import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { resolveVerifiedEditorialUnitContext } from "../domain/editorial-unit-context.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift
} from "./editorial-contract-records.js";

const measured = (source: ProductRecord): ProductRecord => ({
  ...source,
  longDescription: `La carretilla elevadora ${source.brand} ${source.model} tiene capacidad nominal de carga.`,
  specs: { ...source.specs, "Centro de carga": "500 mm", "Radio de giro": "2000 mm" }
});

const baseGeneral = "La ficha técnica recoge las dimensiones y prestaciones del equipo.";

test("medidas de carretilla acreditadas por fuente se interpretan por las tres rutas de proveedor", () => {
  for (const source of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const record = measured(source);
    const original = JSON.stringify(record);
    const enriched = resolveSourceEditorialClaims(record, record, baseGeneral) ?? "";
    assert.match(enriched, /centro de carga declarado.*500 mm/u, record.providerId);
    assert.match(enriched, /radio de giro indicado.*2\.000 mm/u, record.providerId);
    assert.match(resolveReusableEditorial(record).general ?? "", /centro de carga declarado de 500 mm/u);
    assert.match(resolveReusableEditorial(record).general ?? "", /radio de giro declarado de 2 m/u);
    assert.equal(JSON.stringify(record), original);
  }
});

test("las medidas no se propagan a reconciliaciones discrepantes ni se duplican", () => {
  const source = measured(controlledGamForklift());
  const changed = { ...source, specs: { ...source.specs, "Centro de carga": "600 mm", "Radio de giro": "2500 mm" } };
  assert.equal(resolveSourceEditorialClaims(source, changed, baseGeneral), baseGeneral);
  const general = resolveReusableEditorial(changed, null, source).general ?? "";
  assert.doesNotMatch(general, /centro de carga declarado|radio de giro declarado/u);
  assert.match(general, /2\.500 kg/u);
  const missing = { ...source, specs: { ...source.specs, "Centro de carga": "500 kg", "Radio de giro": "2000 m" } };
  assert.equal(resolveSourceEditorialClaims(missing, missing, baseGeneral), baseGeneral);
  assert.equal(resolveSourceEditorialClaims(source, source,
    `${baseGeneral} El centro de carga y el radio de giro están declarados.`),
  `${baseGeneral} El centro de carga y el radio de giro están declarados.`);
  const contradiction = { ...source, longDescription: "El centro de carga indicado es de 800 mm." };
  assert.doesNotMatch(resolveSourceEditorialClaims(contradiction, contradiction, baseGeneral) ?? "", /centro de carga declarado/u);
});

test("una variante, referencia, proveedor o condición distinta no autoriza la reutilización de medidas", () => {
  const record = measured(controlledGomarizForklift());
  for (const changed of [
    { ...record, reference: "OTRA-UNIDAD" },
    { ...record, model: "VARIANTE" },
    { ...record, providerId: "gam" },
    { ...record, condition: "Nuevo" as const }
  ]) {
    assert.equal(resolveSourceEditorialClaims(record, changed, baseGeneral), baseGeneral);
    const general = resolveReusableEditorial(changed, null, record).general ?? "";
    assert.doesNotMatch(general, /centro de carga declarado|radio de giro declarado/u);
  }
});

const unit = (): ProductRecord => ({
  ...controlledGamForklift(),
  condition: "Segunda mano",
  year: "2018",
  horometer: "1616 horas",
  longDescription: "Carretilla elevadora MARCA MODELO10 fabricada en 2018.",
  specs: {
    ...controlledGamForklift().specs,
    "Nº de serie": "AB123456",
    "Horómetro": "1616 horas"
  }
});

test("número de serie y horómetro requieren datos coincidentes de la misma unidad", () => {
  const source = unit();
  const original = JSON.stringify(source);
  const enriched = resolveVerifiedEditorialUnitContext(source, baseGeneral, source) ?? "";
  assert.match(enriched, /número de serie AB123456/u);
  assert.match(enriched, /horómetro de 1616 horas/u);
  const other = { ...source, reference: "CONTROL-04" };
  assert.equal(resolveVerifiedEditorialUnitContext(source, baseGeneral, other), baseGeneral);
  const changed = { ...source, specs: { ...source.specs, "Nº de serie": "CD123456", "Horómetro": "1700 horas" } };
  assert.equal(resolveVerifiedEditorialUnitContext(source, baseGeneral, changed), baseGeneral);
  const withSerial: ProductRecord = { ...source, serialNumber: "AB123456" };
  assert.doesNotMatch(resolveVerifiedEditorialUnitContext(withSerial, baseGeneral,
    { ...withSerial, specs: { ...withSerial.specs, "Nº de serie": "ZX987654" } }) ?? "", /AB123456/u);
  const incompatibleYear = { ...source, longDescription: "Carretilla elevadora MARCA MODELO10 fabricada en 2020." };
  assert.equal(resolveVerifiedEditorialUnitContext(incompatibleYear, baseGeneral), baseGeneral);
  assert.equal(resolveVerifiedEditorialUnitContext(source,
    `${baseGeneral} Número de serie AB123456, con 1616 horas.`),
  `${baseGeneral} Número de serie AB123456, con 1616 horas.`);
  assert.equal(JSON.stringify(source), original);
});

test("la preparación incorpora contexto de unidad sin convertirse en un narrador por referencia", () => {
  const first = unit();
  const second: ProductRecord = {
    ...first,
    reference: "CONTROL-99",
    url: "https://online.gamrentals.com/es/carretillas/CONTROL-99-carretilla-elevadora",
    specs: { ...first.specs, "Nº de serie": "ZX987654", "Horómetro": "2200 horas" },
    horometer: "2200 horas"
  };
  const firstGeneral = prepareSourceProduct(first).product.description_general ?? "";
  const secondGeneral = prepareSourceProduct(second).product.description_general ?? "";
  assert.match(firstGeneral, /AB123456/u);
  assert.match(secondGeneral, /ZX987654/u);
  assert.doesNotMatch(firstGeneral, /ZX987654/u);
  assert.doesNotMatch(secondGeneral, /AB123456/u);
});

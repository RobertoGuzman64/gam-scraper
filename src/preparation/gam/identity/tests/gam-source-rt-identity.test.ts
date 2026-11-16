import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reconcileGamSourceIdentity } from "../reconciliation/gam-source-identity.js";

const source = (reference: string): ProductRecord => accreditedSourceRecord("gam-original", reference);

test("GAM 6981: identidad Genie corroborada por modelo, URL, ficha y textos originales", () => {
  const record = source("6981");
  const snapshot = JSON.stringify(record);
  const reconciled = reconcileGamSourceIdentity(record);
  assert.notStrictEqual(reconciled, record);
  assert.equal(reconciled.title, "Plataforma tijera diésel 12M GENIE GS-3384RT");
  assert.equal(reconciled.model, record.model);
  assert.deepEqual(reconciled.specs, record.specs);
  assert.equal(reconciled.url, record.url);
  assert.equal(reconciled.serialNumber, record.serialNumber);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.match(prepared.product.title ?? "", /GENIE GS-3384RT/u);
  assert.equal(prepared.product.spec.Modelo, "GS-3384RT");
  assert.equal(JSON.stringify(record), snapshot);
});

test("GAM: ausencia de corroboración de identidad RT no rectifica el título", () => {
  const record = source("6981");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "6981-OTRA" },
    { ...record, url: "https://example.invalid/es/plataformas/6981-genie" },
    { ...record, brand: "OTRA" },
    { ...record, model: "GS-5390RT" },
    { ...record, specs: { ...record.specs, Modelo: "GS-5390RT" } },
    { ...record, shortDescription: "➨ GENIE GS-5390 RT ➨ Otra máquina" },
    { ...record, longDescription: "No se dispone de descripción original de fabricante." }
  ];
  for (const variant of variants) {
    assert.strictEqual(reconcileGamSourceIdentity(variant), variant);
  }
});

test("GAM: el soporte RT no altera identidades de otras fichas", () => {
  for (const reference of ["6775", "6172"]) {
    const record = source(reference);
    const snapshot = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.issues, [], reference);
    assert.equal(JSON.stringify(record), snapshot, reference);
  }
});

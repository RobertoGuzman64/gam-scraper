import { reconcileGamHorometer } from "../../technical/reconciliation/gam-horometer.js";
import { campaign1VerifiedBasketCorrections, campaign2VerifiedBasketCorrections, phase4VerifiedBasketCorrections } from "../../../testing/phase2-basket-dimensions.js";
import assert from "node:assert/strict";
import test from "node:test";
import { requireProductReference } from "../../../testing/require-product-reference.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../../../shared/classification/mapping/attribute-mapping.js";
import { prepareProduct } from "../../../../commercial/legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const reference = (id: string): ProductRecord => requireProductReference(source.products, id);
const attribute = (name: string) => {
  const result = catalog.attributes.find((value) => value.name === name);
  assert.ok(result, name);
  return result;
};
const resolved = (record: ProductRecord, name: string) => resolveAttribute(record, attribute(name));

const baskets = ["6607", "6630", "6632", "6631", "6614", "6616", "6615", "6642", "6625", "6669", "6617", "6626"] as const;

test("las cestas corruptas solo se recuperan con evidencias acreditadas", () => {
  for (const id of baskets) {
    const record = reference(id);
    const prepared = prepareProduct(record, catalog);
    assert.deepEqual(resolved(record, "Dimensiones de la cesta"), { status: "not_observed", value: null }, id);
    const verified = phase4VerifiedBasketCorrections.get(id) ?? campaign2VerifiedBasketCorrections.get(id) ?? campaign1VerifiedBasketCorrections.get(id);
    assert.equal(prepared.status, verified ? "ready" : "review", id);
    if (!verified) assert.ok(prepared.issues.some((issue) => issue.startsWith("Dimensiones Cesta no acreditables")), id);
    assert.equal(prepared.product.spec["Dimensiones Cesta"], verified ?? record.specs?.["Dimensiones Cesta"], id);
    assert.deepEqual(prepared.product.attributes.filter((item) => item.attributeID === attribute("Dimensiones de la cesta").id)
      .map((item) => item.value), verified ? [verified] : [], id);
  }
});

test("las ternas CTE contrastadas se expresan en metros sin alterar la rotación", () => {
  for (const id of ["6169", "6171"]) {
    const record = reference(id);
    const prepared = prepareProduct(record, catalog);
    assert.deepEqual(resolved(record, "Dimensiones de la cesta"), { status: "not_observed", value: null }, id);
    assert.deepEqual(resolved(record, "Rotación de torreta"), { status: "not_observed", value: null }, id);
    assert.equal(prepared.status, "ready", id);
    assert.equal(prepared.product.spec["Dimensiones Cesta"], "1,4 x 0,7 x 1,1 m");
    assert.equal(prepared.product.spec["Rotación de torreta"], "190º+190º");
  }
});

test("NA, error de hoja y configuraciones alternativas no fingen horas, altura o mástil", () => {
  const checks = [
    ["6775", "Horas de uso", "Horómetro"],
    ["2130", "Altura de elevación", "Altura de elevación (mm)"],
    ["18", "Altura de elevación", "Altura Elevación (Industr.)"],
    ["18", "Tipo de mástil", "Tipo Mástil"]
  ] as const;
  for (const [id, name, sourceKey] of checks) {
    const record = reference(id);
    const prepared = prepareProduct(record, catalog);
    assert.deepEqual(resolved(record, name), { status: "not_observed", value: null }, `${id}:${name}`);
    assert.equal(prepared.status, "ready", id);
    assert.equal(prepared.product.spec[sourceKey], id === "2130" ? undefined : reconcileGamHorometer(record).specs?.[sourceKey]);
    if (id === "2130") assert.equal(record.specs?.[sourceKey], "#VALUE! mm");
    assert.equal(prepared.product.attributes.some((item) => item.attributeID === attribute(name).id), false);
  }
});

test("un dato secundario o un conflicto de identidad impide normalizar el origen corrupto como ausente", () => {
  const basket = reference("6607");
  const withOtherMeasurement = {
    ...basket, specs: { ...basket.specs, "Dimensiones de la cesta": "2 x 1 metros" }
  };
  assert.notEqual(resolved(withOtherMeasurement, "Dimensiones de la cesta").status, "not_observed");
  const withIndependentEvidence = {
    ...basket, longDescription: `${basket.longDescription ?? ""} La cesta tiene dimensiones de 1,76 x 0,83 m.`
  };
  assert.equal(resolved(withIndependentEvidence, "Dimensiones de la cesta").status, "invalid");
  const conflictedIdentity = reference("6236");
  assert.equal(resolved(conflictedIdentity, "Dimensiones de la cesta").status, "rejected");
  assert.equal(prepareProduct({ ...conflictedIdentity, longDescription: "Origen técnico alterado" }, catalog).status, "review");
  const distorted = { ...reference("6169"), specs: { ...reference("6169").specs, "Rotación de torreta": "190º+200º" } };
  assert.equal(resolved(distorted, "Rotación de torreta").status, "invalid");
  const withConventional = { ...reference("6169"), specs: { ...reference("6169").specs, "Rotación de torreta": "380º" } };
  assert.deepEqual(resolved(withConventional, "Rotación de torreta"), { status: "resolved", value: 380 });
  const otherProvider = { ...basket, providerId: "gomariz" };
  assert.equal(resolved(otherProvider, "Dimensiones de la cesta").status, "not_observed");
});

test("la política no convierte contradicciones técnicas reales en atributos vacíos", () => {
  for (const [id, name, expected] of [
    ["6723", "Capacidad de carga", "contradiction"],
    ["3134", "Altura de elevación", "contradiction"],
    ["6236", "Modelo", "rejected"]
  ] as const) {
    const record = reference(id);
    assert.equal(resolved(record, name).status, expected, `${id}:${name}`);
    assert.equal(prepareProduct(record, catalog).status, "ready", id);
  }
});

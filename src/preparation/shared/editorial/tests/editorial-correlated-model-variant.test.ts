import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { hasGamCorroboratedModelVariantConflict, hasGamModelTitleDisagreement } from "../../../gam/identity/evidence/gam-crossed-editorial-identity.js";
import { unresolvedEditorialModelVariantShort, unresolvedEditorialModelVariantGeneral } from "../domain/editorial-identity-summary.js";
import { resolveEditorialSource } from "../domain/editorial-source.js";
import { verifiedEditorialIdentity, verifiedEditorialStructuredIdentity } from "../domain/editorial-source-contract.js";

const historical = (reference: string): ProductRecord => accreditedSourceRecord("gam-original", reference);

test("una variante GAM no acreditada no se valida mediante una coincidencia por prefijo", () => {
  for (const reference of ["6934"]) {
    const source = historical(reference);
    const snapshot = JSON.stringify(source);
    assert.equal(verifiedEditorialIdentity(source), false, reference);
    assert.equal(verifiedEditorialStructuredIdentity(source), true, reference);
    assert.ok(resolveEditorialSource(source), reference);
    assert.equal(hasGamModelTitleDisagreement(source), true, reference);
    assert.equal(hasGamCorroboratedModelVariantConflict(source), true, reference);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "review", reference);
    assert.ok(prepared.issues.includes("Identidad GAM contradictoria entre título y modelo técnico"), reference);
    assert.equal(prepared.product.description, unresolvedEditorialModelVariantShort, reference);
    assert.equal(prepared.product.description_general, unresolvedEditorialModelVariantGeneral, reference);
    assert.equal(prepared.product.reference, source.reference);
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.deepEqual(prepared.product.spec.Marca, source.specs?.Marca);
    assert.deepEqual(prepared.product.spec.Modelo, source.specs?.Modelo);
    assert.equal(JSON.stringify(source), snapshot, reference);
  }
});

test("la contradicción de variante afecta también a otra unidad con procedencia individual propia", () => {
  const source = historical("6934");
  const nextReference = "6934-NUEVA";
  const next: ProductRecord = {
    ...source,
    reference: nextReference,
    url: source.url.replace(`/${source.reference}-`, `/${nextReference}-`),
    serialNumber: null,
    horometer: null
  };
  assert.equal(hasGamCorroboratedModelVariantConflict(next), true);
  const prepared = prepareSourceProduct(next);
  assert.equal(prepared.status, "review");
  assert.equal(prepared.product.description_general, unresolvedEditorialModelVariantGeneral);
  assert.equal(prepared.product.description, unresolvedEditorialModelVariantShort);
  assert.ok(prepared.issues.some((issue) => issue.startsWith("Identidad GAM contradictoria")));
});

test("identidad genuina, variantes completas y equivalencias de separadores quedan intactas", () => {
  const source = historical("6998");
  assert.equal(verifiedEditorialIdentity(source), true);
  assert.equal(hasGamCorroboratedModelVariantConflict(source), false);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.ok(prepared.product.description);
  assert.ok(prepared.product.description_general);
  assert.notEqual(prepared.product.description_general, unresolvedEditorialModelVariantGeneral);
  const genuineVariant: ProductRecord = {
    ...historical("6934"),
    model: "E300AJP",
    specs: { ...historical("6934").specs, Modelo: "E300AJP" }
  };
  assert.equal(verifiedEditorialIdentity(genuineVariant), true);
  assert.equal(hasGamCorroboratedModelVariantConflict(genuineVariant), false);
});

test("sin corroboración doble de título y URL no se crea una contradicción de variante", () => {
  const source = historical("6934");
  const untouched = [
    { ...source, title: source.title?.replaceAll("E300AJP", "E300AJ") ?? null },
    { ...source, url: `${source.url}?variante=1` },
    { ...source, url: source.url.replace("e300ajp", "e300aj") },
    { ...source, url: source.url.replace("online.gamrentals.com", "otro.example") },
    { ...source, providerId: "gomariz" },
    { ...source, reference: "OTRA-UNIDAD" },
    { ...source, specs: { ...source.specs, Modelo: "OTRA-VARIANTE" } },
    { ...source, brand: "OTRA MARCA" }
  ];
  for (const record of untouched) {
    assert.equal(hasGamCorroboratedModelVariantConflict(record), false, JSON.stringify(record).slice(0, 180));
  }
});

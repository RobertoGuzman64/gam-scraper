import { accreditedSourceSamples } from "../../../../testing/domain-cases/accredited-source-samples.js";
import assert from "node:assert/strict";
import test from "node:test";
import { requireProductReference } from "../../../testing/require-product-reference.js";
import { gamHistoricalSerialCollisionGroups } from "../../technical/tests/support/gam-technical-cohorts.js";
import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { findSerialNumberCollisions } from "../../../../catalog/identity-conflicts.js";
import { resolveAttribute } from "../../../shared/classification/mapping/attribute-mapping.js";
import {
  gamElevationBrandConflict, gamElevationIdentityConflict,
  gamElevationSourceIdentityConflict, gamElevationSourceModelConflict
} from "../evidence/elevation-identity.js";
import { prepareImportBatch } from "../../../batch-identity.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { prepareProduct } from "../../../../commercial/legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const source = { products: accreditedSourceSamples("gam-historical") };
const byReference = (reference: string): ProductRecord => requireProductReference(source.products, reference);

const historicalBatch = prepareImportBatch(source.products, catalog);

const model = catalog.attributes.find((item) => item.name === "Modelo");
assert.ok(model);

test("un modelo de la misma marca diferente entre texto y ficha técnica bloquea el falso ready", () => {
  const sourceRecord = byReference("6236");
  assert.equal(gamElevationBrandConflict(sourceRecord), false);
  assert.equal(gamElevationSourceModelConflict(sourceRecord), true);
  assert.equal(gamElevationSourceIdentityConflict(sourceRecord), true);
  assert.equal(gamElevationIdentityConflict(sourceRecord), true);
  assert.deepEqual(resolveAttribute(sourceRecord, model), { status: "rejected", value: null });
  const prepared = prepareProduct({ ...sourceRecord, longDescription: "Descripción técnica no acreditada" }, catalog);
  assert.equal(prepared.status, "review");
  assert.ok(prepared.issues.includes("Identidad GAM contradictoria entre título, resumen y ficha técnica"));
  assert.ok(prepared.issues.includes("Atributo rechazado por seguridad: Modelo"));
  assert.ok(!prepared.product.attributes.some((attribute) => attribute.attributeID === model.id));
  assert.equal(prepared.product.reference, "6236");
  assert.equal(prepared.product.sourceUrl, sourceRecord.url);
});

test("ni abreviaturas ni variantes con núcleo numérico idéntico producen falsos conflictos", () => {
  for (const reference of ["6607", "5855", "6984", "6650", "6979", "6911", "5899"]) {
    assert.equal(gamElevationSourceModelConflict(byReference(reference)), false, reference);
  }
  const sourceRecord = byReference("6236");
  assert.equal(gamElevationSourceModelConflict({
    ...sourceRecord, title: "Plataforma SNORKEL S4732E",
    shortDescription: "➨ SNORKEL S4732E Segunda Mano"
  }), false);
  assert.equal(gamElevationSourceModelConflict({
    ...sourceRecord, model: "S3219E-LI", specs: { ...sourceRecord.specs, Modelo: "S3219E-LI" }
  }), false);
});

test("la discrepancia requiere marca, modelo, título, resumen y ficha del mismo origen", () => {
  const sourceRecord = byReference("6236");
  for (const invalid of [
    { ...sourceRecord, providerId: "gomariz" },
    { ...sourceRecord, shortDescription: null },
    { ...sourceRecord, title: "Plataforma SNORKEL S4732E" },
    { ...sourceRecord, specs: { ...sourceRecord.specs, Modelo: "S3219E" } },
    { ...sourceRecord, specs: { ...sourceRecord.specs, Marca: "JLG" } },
    { ...sourceRecord, url: "https://example.com/es/6236" }
  ]) assert.equal(gamElevationSourceModelConflict(invalid), false);
});

test("las tres series compartidas conservan seis referencias sin fusionarlas y tres siguen bloqueadas", () => {
  const batch = historicalBatch;
  assert.deepEqual(findSerialNumberCollisions(source.products).map((item) =>
    item.products.map((record) => record.reference).sort()).sort(), gamHistoricalSerialCollisionGroups.map((group) => [...group]).sort());
  assert.equal(batch.products.length, source.products.length);
  assert.equal(new Set(batch.products.map((item) => item.product.reference)).size, source.products.length);
  for (const reference of ["6682", "6703"]) {
    const entry = batch.products.find((item) => item.product.reference === reference);
    assert.ok(entry, reference);
    assert.equal(entry.status, "review", reference);
    assert.ok(entry.issues.some((issue) => issue.includes("Número de serie") && issue.includes("compartido")));
  }
});

test("GAM: dos Z45/25J conservan dimensiones, pendiente e identidad propias de cada unidad", async () => {
  const current = { products: accreditedSourceSamples("gam-original") };
  const originals = ["6607", "6984"].map((reference) => requireProductReference(current.products, reference));
  const expected = [
    { reference: "6607", year: "2012", width: "2290 mm", slope: "45%", serial: "Z452512B2168" },
    { reference: "6984", year: "2018", width: "1790 mm", slope: "25%", serial: "Z4525M-7794" }
  ] as const;
  const forward = originals.map((record, index) => {
    const snapshot = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    const values = expected[index];
    assert.ok(values);
    assert.equal(record.model, "Z45/25J");
    assert.equal(prepared.status, "ready", record.reference ?? record.url);
    assert.equal(prepared.product.reference, values.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.equal(prepared.product.spec.Anchura, values.width);
    assert.equal(prepared.product.spec["Pendiente superable"], values.slope);
    assert.equal(prepared.product.spec["Nº de serie"], values.serial);
    assert.equal(prepared.product.spec["Año de fabricación"], values.year);
    assert.equal(JSON.stringify(record), snapshot);
    return prepared.product;
  });
  for (const [index, record] of [...originals].reverse().entries()) {
    assert.deepEqual(prepareSourceProduct(record).product, forward[originals.length - index - 1]);
  }
});

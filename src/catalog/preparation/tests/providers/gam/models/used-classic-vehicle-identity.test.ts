import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { reconcileGamVerifiedClassicVehicleIdentity } from "../../../../evidence/providers/gam/identity/used-classic-vehicle-identity.js";
import { prepareProduct } from "../../../../../legacy-export/prepare-product.js";
import { projectCommercialCategory } from "../../../../../commercial/category-projection.js";

const catalog = await loadImportCatalog();
const original = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const source = (reference: string): ProductRecord => {
  const record = original.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};
const identities = [
  { reference: "6688", brand: "ALFA ROMEO", model: "SPIDER JUNIOR", previous: "ALFA ROMEO" },
  { reference: "6689", brand: "AUDI", model: "80 2,6 CABRIO", previous: "AUDI" },
  { reference: "6690", brand: "PEUGEOT", model: "304 S CABRIOLET", previous: "PEUGEOUT" }
] as const;

test("recupera marcas y modelos clásicos comprobados sin modificar las fuentes originales", () => {
  for (const { reference, brand, model, previous } of identities) {
    const record = source(reference);
    const snapshot = JSON.stringify(record);
    const corrected = reconcileGamVerifiedClassicVehicleIdentity(record);
    assert.notStrictEqual(corrected, record, reference);
    assert.equal(corrected.brand, brand, reference);
    assert.equal(corrected.model, model, reference);
    assert.equal(corrected.specs?.Marca, brand, reference);
    assert.equal(corrected.specs?.Modelo, model, reference);
    assert.equal(corrected.specs?.[previous], undefined, reference);
    assert.equal(corrected.reference, record.reference, reference);
    assert.equal(corrected.url, record.url, reference);
    assert.equal(corrected.condition, record.condition, reference);
    assert.equal(corrected.serialNumber, record.serialNumber, reference);
    assert.equal(corrected.title, record.title, reference);
    assert.equal(corrected.shortDescription, record.shortDescription, reference);
    assert.equal(corrected.longDescription, record.longDescription, reference);
    assert.equal(corrected.specs?.["Matrícula"], record.specs?.["Matrícula"], reference);
    assert.equal(corrected.specs?.["Kilómetros"], record.specs?.["Kilómetros"], reference);
    assert.equal(JSON.stringify(record), snapshot, reference);
    const prepared = projectCommercialCategory(record, prepareProduct(record, catalog), catalog);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.condition, "Segunda_Mano", reference);
    assert.equal(prepared.product.categorySellID, 74, reference);
    assert.equal(prepared.product.spec.Marca, brand, reference);
    assert.equal(prepared.product.spec.Modelo, model, reference);
    assert.equal(prepared.product.spec[previous], undefined, reference);
    assert.deepEqual(prepared.product.attributes, [], reference);
  }
});

test("no reconstruye identidades cuando falta una prueba independiente de la unidad", () => {
  for (const { reference, previous } of identities) {
    const record = source(reference);
    const alternatives: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: `${reference}-2` },
      { ...record, categoryKey: "otros" },
      { ...record, condition: "Nuevo" },
      { ...record, title: "Otro vehículo de ocasión" },
      { ...record, shortDescription: "Modelo no identificado" },
      { ...record, model: "MODELO DISTINTO" },
      { ...record, year: "2000" },
      { ...record, externalReference: "MATRICULA DISTINTA" },
      { ...record, url: record.url.replace("/vehiculos-segunda-mano/", "/otros/") },
      { ...record, specs: { ...record.specs, "Matrícula": "MATRICULA DISTINTA" } },
      { ...record, specs: { ...record.specs, [previous]: "OTRA MARCA" } },
      { ...record, specs: { ...record.specs, Marca: "OTRA MARCA" } }
    ];
    for (const [index, altered] of alternatives.entries()) {
      assert.strictEqual(reconcileGamVerifiedClassicVehicleIdentity(altered), altered, `${reference}:${index}`);
    }
  }
  assert.strictEqual(reconcileGamVerifiedClassicVehicleIdentity(source("6806")), source("6806"));
});

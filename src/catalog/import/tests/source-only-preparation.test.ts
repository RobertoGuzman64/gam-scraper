import assert from "node:assert/strict";
import test from "node:test";
import { prepareSourceProduct } from "../preparation/prepare-product.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";
import { analyzeSourceContentGaps } from "../../../tools/catalog-content-gaps.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

const record = (reference: string, specs: ProductRecord["specs"] = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "plataformas-tijera", categoryName: "Plataformas de tijera",
  url: `https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/${reference}-equipo`,
  title: "Plataforma de tijera eléctrica XCMG", shortDescription: "Plataforma eléctrica",
  longDescription: null, price: null, condition: "Nuevo", reference,
  brand: "XCMG", model: "Tijera", year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null, specs
});

test("la preparación canónica no asigna identificadores comerciales y conserva las fuentes", () => {
  const product = record("TEST-1", { "Altura de trabajo": "8 m", "Capacidad de carga": "250 kg" });
  const before = JSON.stringify(product);
  const prepared = prepareSourceProduct(product);
  assert.equal(prepared.product.categorySellID, null);
  assert.equal(prepared.product.category, product.categoryName);
  assert.deepEqual(prepared.product.attributes, []);
  assert.deepEqual(prepared.product.spec, product.specs);
  assert.equal(prepared.importIssues, undefined);
  assert.equal(JSON.stringify(product), before);
  assert.deepEqual(prepareImportBatch([product]).products[0], prepared);
});

test("el auditor compara especificaciones originales por categoría sin requerir categorías comerciales", () => {
  const sources = [
    record("TEST-1", { "Altura de trabajo": "8 m" }),
    record("TEST-2", { "Altura de trabajo": "9 m" }),
    record("TEST-3", { "Ancho": "1 m" })
  ];
  const inputs = sources.map((source) => ({ source, prepared: prepareSourceProduct(source) }));
  const before = JSON.stringify(inputs);
  const result = analyzeSourceContentGaps(inputs);
  const group = result.groups[0];
  assert.ok(group);
  assert.equal(group.categorySellID, null);
  assert.equal(group.sourceCategoryKey, "plataformas-tijera");
  assert.equal(group.comparable, true);
  const height = group.observations.find((observation) => observation.field.kind === "spec" && observation.field.key === "Altura de trabajo (mm)");
  assert.ok(height);
  assert.equal(height.present, 2);
  assert.equal(height.missing, 1);
  assert.equal(height.coveragePercent, 66.67);
  assert.deepEqual(height.missingIdentities, ["gam:ref:test-3"]);
  assert.equal(JSON.stringify(inputs), before);
});

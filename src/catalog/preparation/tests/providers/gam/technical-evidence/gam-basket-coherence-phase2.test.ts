import { phase2BasketCorrections, phase4VerifiedBasketCorrections } from "../../../support/phase2-basket-dimensions.js";
import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGamBasketDimensions } from "../../../../reconciliation/gam-basket-dimensions.js";
import { normalizeSpecsObject } from "../../../../../normalization/normalize-specs.js";

const source = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const records = new Map(source.products.map((record) => [record.reference, record]));
const original = (reference: string) => {
  const record = records.get(reference);
  assert.ok(record, reference);
  return record;
};

test("fase 2: prepara 24 medidas verificables de forma idéntica a su evidencia sin editar la fuente", () => {
  for (const [reference, expected] of phase2BasketCorrections) {
    const record = original(reference);
    const sourceBefore = JSON.stringify(record);
    const result = prepareSourceProduct(record);
    assert.equal(result.product.spec["Dimensiones Cesta"], expected, reference);
    assert.equal(result.status, "ready", reference);
    assert.equal(JSON.stringify(record), sourceBefore, reference);
    assert.equal(reconcileGamBasketDimensions(reconcileGamBasketDimensions(record)).specs?.["Dimensiones Cesta"], expected);
  }
});

test("las dos dimensiones adicionales acreditadas se recuperan sin modificar el original", () => {
  for (const [reference, dimensions] of phase4VerifiedBasketCorrections) {
    const record = original(reference);
    const result = prepareSourceProduct(record);
    assert.equal(result.product.spec["Dimensiones Cesta"], dimensions, reference);
    assert.equal(result.status, "ready", reference);
    assert.notEqual(result.product.spec["Dimensiones Cesta"], record.specs?.["Dimensiones Cesta"], reference);
  }
});

test("fase 2: no recupera medidas cuando cambia la cifra corroborada, la unidad o la identidad de proveedor", () => {
  const record = original("6162");
  const wrongDimensions = { ...record, specs: { ...record.specs, "Dimensiones Cesta": "1400x750x1100 metros" } };
  assert.equal(reconcileGamBasketDimensions(wrongDimensions), wrongDimensions);
  assert.equal(prepareSourceProduct(wrongDimensions).status, "review");
  const withoutProse = { ...record, longDescription: "Sin medidas de la cesta" };
  assert.equal(reconcileGamBasketDimensions(withoutProse), withoutProse);
  const otherProvider = { ...record, providerId: "gomariz" };
  assert.equal(reconcileGamBasketDimensions(otherProvider), otherProvider);
});

test("fase 2: el normalizador no inventa decimales ni acepta dimensiones deformadas", () => {
  const examples = [
    ["1,83 x 0,76 metros", { ancho: 1830, largo: 760 }],
    ["2,27 x 1,12 m metros", { ancho: 2270, largo: 1120 }],
    ["1400x700 mm metros", { ancho: 1400, largo: 700 }],
    ["1.400 x 700 mm", { ancho: 1400, largo: 700 }],
    ["1 76 83X0 metros", null],
    ["1400x700x1100 metros", null],
    ["1400x700 metros", null],
    ["1,83 x 0,76", null]
  ] as const;
  for (const [value, expected] of examples) {
    const result = normalizeSpecsObject({ "Dimensiones Cesta": value });
    assert.deepEqual(result.normalized["Dimensiones cesta (mm)"] ?? null, expected, value);
  }
});

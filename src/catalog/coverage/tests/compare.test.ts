import assert from "node:assert/strict";
import test from "node:test";
import { readHistoricalGamCoverageCatalog, GAM_MISSING_REFERENCES } from "./gam-coverage-fixtures.js";
import { parseCanonicalCatalog } from "../../canonical-catalog.js";
import { compareCanonicalCoverage } from "../compare.js";

const previous = await readHistoricalGamCoverageCatalog();
const disappearing = GAM_MISSING_REFERENCES;

test("detecta las cuatro referencias GAM ausentes y sus URL sin perder otras", () => {
  const products = previous.products.filter((item) => !disappearing.has(item.reference ?? ""));
  const current = parseCanonicalCatalog({ ...previous, productCount: products.length, products });
  const comparison = compareCanonicalCoverage(previous, current);
  assert.equal(comparison.previousCount, previous.productCount);
  assert.equal(comparison.currentCount, previous.productCount - disappearing.size);
  assert.deepEqual(new Set(comparison.missing.map((product) => product.reference)), disappearing);
  assert.equal(comparison.added.length, 0);
  assert.equal(comparison.changed, 0);
  assert.ok(comparison.missing.every((product) => product.url.startsWith("https://online.gamrentals.com/es/")));
});

test("una sustitución que mantenga el contador no oculta pérdidas", () => {
  const removed = previous.products.find((record) => record.reference === "6942");
  assert.ok(removed);
  const products = previous.products.map((product) => product === removed
    ? { ...product, reference: "NUEVA-REF", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/9000-nueva-ref" }
    : product);
  const result = compareCanonicalCoverage(previous, parseCanonicalCatalog({ ...previous, products }));
  assert.deepEqual(result.missing.map((product) => product.reference), ["6942"]);
  assert.deepEqual(result.added.map((product) => product.reference), ["NUEVA-REF"]);
});

test("rechaza proveedor o ámbito distinto", () => {
  assert.throws(() => compareCanonicalCoverage(previous, { ...previous, scope: "aaaaaaaaaaaaaaaa" }), /no comparable/);
  assert.throws(() => compareCanonicalCoverage(previous, { ...previous, providerId: "gomariz" }), /no comparable/);
});

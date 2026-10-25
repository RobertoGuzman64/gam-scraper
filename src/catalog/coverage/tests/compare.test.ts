import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseCanonicalCatalog } from "../../canonical-catalog.js";
import { compareCanonicalCoverage } from "../compare.js";

const sourceFile = new URL("../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url);
const previous = parseCanonicalCatalog(JSON.parse(await readFile(sourceFile, "utf8")));
const disappearing = new Set(["6942", "6948", "6366", "6676"]);

test("detecta las cuatro referencias GAM ausentes y sus URL sin perder otras", () => {
  const products = previous.products.filter((item) => !disappearing.has(item.reference ?? ""));
  const current = parseCanonicalCatalog({ ...previous, productCount: products.length, products });
  const comparison = compareCanonicalCoverage(previous, current);
  assert.equal(comparison.previousCount, 1008);
  assert.equal(comparison.currentCount, 1004);
  assert.deepEqual(new Set(comparison.missing.map((product) => product.reference)), disappearing);
  assert.equal(comparison.added.length, 0);
  assert.equal(comparison.changed, 0);
  assert.ok(comparison.missing.every((product) => product.url.startsWith("https://online.gamrentals.com/es/")));
});

test("una sustitución que mantenga el contador no oculta pérdidas", () => {
  const removed = previous.products.find((record) => record.reference === "6942");
  assert.ok(removed);
  const products = previous.products.map((product) => product === removed
    ? { ...product, reference: "NUEVA-F49", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/9000-nueva-f49" }
    : product);
  const result = compareCanonicalCoverage(previous, parseCanonicalCatalog({ ...previous, products }));
  assert.deepEqual(result.missing.map((product) => product.reference), ["6942"]);
  assert.deepEqual(result.added.map((product) => product.reference), ["NUEVA-F49"]);
});

test("rechaza proveedor o ámbito distinto", () => {
  assert.throws(() => compareCanonicalCoverage(previous, { ...previous, scope: "aaaaaaaaaaaaaaaa" }), /no comparable/);
  assert.throws(() => compareCanonicalCoverage(previous, { ...previous, providerId: "gomariz" }), /no comparable/);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { CanonicalCatalog } from "../canonical-catalog.js";
import { compareCanonicalCoverage } from "../coverage/compare.js";
import { createCoverageReview, verifyCoverageReview } from "../coverage/review.js";

const product = (reference: string): ProductRecord => ({
  providerId: "gam", categoryKey: "equipos", categoryName: "Equipos",
  reference, url: `https://example.test/equipos/${reference}/ficha`,
  title: "Equipo verificado", shortDescription: null, longDescription: null,
  price: null, brand: null, model: null, year: null, location: null,
  country: null, horometer: null, serialNumber: null, image: null
});

const catalog = (products: readonly ProductRecord[]): CanonicalCatalog => ({
  version: 1, providerId: "gam", prefix: "scrape-gam", scope: "a".repeat(16),
  startedAt: "2026-01-01T08:00:00Z", endedAt: "2026-01-01T09:00:00Z",
  quality: { status: "complete", published: true }, productCount: products.length, products
});

test("las bajas, altas y modificaciones se distinguen sin depender del inventario", () => {
  const previous = catalog([product("1"), product("2"), product("3")]);
  const current = catalog([{ ...product("1"), price: "100" }, product("3"), product("4")]);
  const diff = compareCanonicalCoverage(previous, current);
  assert.equal(diff.previousCount, 3);
  assert.equal(diff.currentCount, 3);
  assert.deepEqual(diff.missing.map((item) => item.reference), ["2"]);
  assert.deepEqual(diff.added.map((item) => item.reference), ["4"]);
  assert.equal(diff.changed, 1);
  assert.deepEqual(diff.changedDetails[0]?.fields, ["price"]);
});

test("no se comparan ámbitos ni proveedores incompatibles", () => {
  const previous = catalog([product("1")]);
  assert.throws(() => compareCanonicalCoverage(previous, { ...previous, scope: "b".repeat(16) }), /no comparable/);
  assert.throws(() => compareCanonicalCoverage(previous, { ...previous, providerId: "gomariz" }), /no comparable/);
});

test("una ausencia requiere acreditación expresa y no admite huellas caducadas", () => {
  const previous = catalog([product("1"), product("2")]);
  const current = catalog([product("1")]);
  const expected = createCoverageReview(previous, current, "a".repeat(64), "b".repeat(64));
  assert.equal(expected.missing.length, 1);
  assert.throws(() => verifyCoverageReview(expected, expected), /pendiente/);
  const reviewed = {
    ...expected,
    missing: expected.missing.map((entry) => ({
      ...entry, decision: "retirado" as const, reason: "Retirada verificada mediante revisión humana",
      evidenceUrls: ["https://example.test/equipos"]
    }))
  };
  assert.doesNotThrow(() => verifyCoverageReview(reviewed, expected));
  assert.throws(() => verifyCoverageReview({ ...reviewed, currentSha256: "c".repeat(64) }, expected), /caducada/);
});

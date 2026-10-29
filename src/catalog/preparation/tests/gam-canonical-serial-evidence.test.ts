import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { findSerialNumberCollisions } from "../../identity-conflicts.js";
import { describeHysterH35ftStockConflict } from "../evidence/providers/gam/hyster-h35ft-serial-evidence.js";
import { verifiedYaleErp35vlCrossListing } from "../evidence/providers/gam/yale-erp35vl-serial-evidence.js";
import { prepareImportBatch } from "../batch-identity.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const original = (reference: string): ProductRecord => {
  const found = source.products.find((product) => product.reference === reference);
  assert.ok(found, reference);
  return found;
};
const yale = [original("6835"), original("6858")];
const hyster = [original("6682"), original("6703")];

const collisionFor = (products: readonly ProductRecord[]) => {
  const collisions = findSerialNumberCollisions(products);
  assert.equal(collisions.length, 1);
  const collision = collisions[0];
  assert.ok(collision);
  return collision;
};

test("GAM: la edición canónica de Yale mantiene ambas referencias sin conflicto inventado", () => {
  const previous = structuredClone(yale);
  assert.equal(yale[0]?.externalReference, "GAM 27262");
  assert.equal(yale[1]?.externalReference, "GAM-27262");
  assert.equal(verifiedYaleErp35vlCrossListing(collisionFor(yale)), true);
  const prepared = prepareImportBatch(yale, catalog);
  assert.deepEqual(prepared.totals, { ready: 2, review: 0 });
  assert.deepEqual(prepared.products.map((product) => product.product.spec), yale.map((product) => product.specs));
  assert.deepEqual(prepared.products.map((product) => product.product.reference), ["6835", "6858"]);
  assert.deepEqual(yale, previous);
});

test("GAM: una modificación no acreditada impide ignorar la colisión Yale", () => {
  const older = yale[0];
  const newer = yale[1];
  assert.ok(older && newer);
  const changed: readonly ProductRecord[] = [
    { ...older, externalReference: "GAM-27262" },
    { ...older, images: older.images?.slice(1) ?? [] },
    { ...older, specs: { ...older.specs, "Horómetro": "1662 horas" } }
  ];
  for (const [index, variant] of changed.entries()) {
    const pair: readonly ProductRecord[] = [variant, newer];
    assert.equal(verifiedYaleErp35vlCrossListing(collisionFor(pair)), false, String(index));
    assert.deepEqual(prepareImportBatch(pair, catalog).totals, { ready: 0, review: 2 }, String(index));
  }
});

test("GAM: Hyster conserva stocks distintos y su serie duplicada en revisión", () => {
  const previous = structuredClone(hyster);
  const collision = collisionFor(hyster);
  assert.match(describeHysterH35ftStockConflict(collision) ?? "", /GAM-11596.*GAM-11594.*placa/);
  const prepared = prepareImportBatch(hyster, catalog);
  assert.deepEqual(prepared.totals, { ready: 0, review: 2 });
  assert.ok(prepared.products.every(({ issues }) => issues.some((issue) => issue.includes("Número de serie P177B10585U compartido"))));
  assert.ok(prepared.products.every(({ issues }) => issues.some((issue) => issue.startsWith("Stock GAM diferenciado:"))));
  assert.deepEqual(prepared.products.map((product) => product.product.spec), hyster.map((product) => product.specs));
  assert.deepEqual(hyster, previous);
});

test("GAM: la preparación integral conserva el catálogo y solo mantiene conflictos reales", () => {
  assert.equal(source.products.length, 983);
  const prepared = prepareImportBatch(source.products, catalog);
  assert.equal(prepared.products.length, source.products.length);
  assert.equal(new Set(prepared.products.map((product) => product.product.reference)).size, source.products.length);
  const reviewed = prepared.products.filter(({ status }) => status === "review");
  assert.deepEqual(reviewed.map(({ product }) => product.reference).sort(), ["6682", "6703"]);
});

import assert from "node:assert/strict";
import test from "node:test";
import { requireProductReference } from "./require-product-reference.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { findSerialNumberCollisions } from "../../identity-conflicts.js";
import { verifiedYaleErp35vlPotentialRepublishedListing } from "../evidence/providers/gam/yale-erp35vl-serial-evidence.js";
import { prepareImportBatch } from "../batch-identity.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const byReference = (reference: string): ProductRecord => requireProductReference(gam.products, reference);
const older = byReference("6835");
const listed = byReference("6858");
const collisionFor = (records: readonly ProductRecord[]) =>
  findSerialNumberCollisions(records).find((item) => item.serialNumber === "A976B08243T");

test("GAM: los anuncios Yale 6835 y 6858 comparten stock acreditado y conservan ambas fichas", () => {
  const originals = structuredClone([older, listed]);
  const collision = collisionFor([older, listed]);
  assert.ok(collision);
  assert.strictEqual(verifiedYaleErp35vlPotentialRepublishedListing(collision), older);
  const result = prepareImportBatch([older, listed], catalog);
  assert.deepEqual(result.totals, { ready: 2, review: 0 });
  assert.equal(result.products[0]?.status, "ready");
  assert.deepEqual(result.products[0]?.issues, []);
  assert.equal(result.products[1]?.status, "ready");
  assert.deepEqual(result.products[1]?.issues, []);
  assert.deepEqual(result.products[0]?.product.spec, older.specs);
  assert.deepEqual(result.products[1]?.product.spec, listed.specs);
  assert.deepEqual([older, listed], originals);
});

test("las variantes de ambas referencias no heredan el diagnóstico de republicación", () => {
  const variants: readonly [ProductRecord, ProductRecord][] = [
    [{ ...older, url: `${older.url}?changed=1` }, listed],
    [{ ...older, reference: "6836" }, listed],
    [{ ...older, serialNumber: "A976B08244T" }, listed],
    [{ ...older, externalReference: "GAM-27262" }, listed],
    [{ ...older, price: "25600" }, listed],
    [{ ...older, longDescription: "Otra descripción" }, listed],
    [{ ...older, specs: { ...older.specs, "Horómetro": "1661 horas" } }, listed],
    [older, { ...listed, externalReference: "GAM-27263" }],
    [older, { ...listed, url: `${listed.url}?changed=1` }],
    [older, { ...listed, model: "ERP30VL" }],
    [older, { ...listed, specs: { ...listed.specs, "Horómetro": "1663 horas" } }]
  ];
  for (const [index, [first, second]] of variants.entries()) {
    const collision = collisionFor([first, second]);
    if (!collision) continue;
    assert.equal(verifiedYaleErp35vlPotentialRepublishedListing(collision), null, String(index));
    const result = prepareImportBatch([first, second], catalog);
    assert.equal(result.products[0]?.status, "review", String(index));
    assert.equal(result.products[1]?.status, "review", String(index));
    assert.equal(result.products[0]?.issues.some((issue) => issue.includes("Posible republicación")), false, String(index));
  }
});

test("tres referencias con la misma serie no se consideran republicación acreditada", () => {
  const third: ProductRecord = { ...older, reference: "6900" };
  const collision = collisionFor([older, listed, third]);
  assert.ok(collision);
  assert.equal(verifiedYaleErp35vlPotentialRepublishedListing(collision), null);
  const result = prepareImportBatch([older, listed, third], catalog);
  assert.deepEqual(result.totals, { ready: 0, review: 3 });
  assert.ok(result.products.every(({ issues }) => issues.every((issue) => !issue.includes("Posible republicación"))));
});

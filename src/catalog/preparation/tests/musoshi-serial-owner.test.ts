import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { findSerialNumberCollisions } from "../../identity-conflicts.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { verifiedMusoshiSerialOwner } from "../evidence/providers/gam/musoshi-serial-evidence.js";
import { prepareImportBatch } from "../batch-identity.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const target = (reference: string): ProductRecord => {
  const product = gam.products.find((record) => record.reference === reference);
  assert.ok(product, reference);
  return product;
};
const musoshi = target("6806");
const zero = target("6807");
const getCollision = (products: readonly ProductRecord[]) => {
  const collision = findSerialNumberCollisions(products).find((item) => item.serialNumber === "NRXL3AALS10000101");
  assert.ok(collision);
  return collision;
};

test("GAM: el VIN corresponde a Musoshi 6806 y Zero 6807 lo descarta sin inventar otro", () => {
  const original = structuredClone([musoshi, zero]);
  const collision = getCollision([zero, musoshi]);
  assert.strictEqual(verifiedMusoshiSerialOwner(collision), musoshi);
  const batch = prepareImportBatch([zero, musoshi], catalog);
  assert.deepEqual(batch.totals, { ready: 2, review: 0 });
  const approved = batch.products.find(({ product }) => product.reference === "6806");
  assert.ok(approved);
  assert.equal(approved.status, "ready");
  assert.deepEqual(approved.issues, []);
  assert.deepEqual(approved.product.spec, musoshi.specs);
  assert.equal(approved.product.categorySellID, null);
  const corrected = batch.products.find(({ product }) => product.reference === "6807");
  assert.ok(corrected);
  assert.equal(corrected.status, "ready");
  assert.equal(Object.hasOwn(corrected.product.spec, "Nº de serie"), false);
  assert.equal(corrected.product.spec["Matrícula"], "2722MHH");
  assert.deepEqual([musoshi, zero], original);
});

test("identidad o evidencia Musoshi alteradas vuelven a bloquear ambas fichas", () => {
  const variants: readonly ProductRecord[] = [
    { ...musoshi, providerId: "gomariz" },
    { ...musoshi, reference: "6808" },
    { ...musoshi, url: `${musoshi.url}?changed=1` },
    { ...musoshi, externalReference: "INQ-04324" },
    { ...musoshi, title: "Otro vehículo" },
    { ...musoshi, brand: "ZERO" },
    { ...musoshi, model: "P1.7" },
    { ...musoshi, year: "2023" },
    { ...musoshi, serialNumber: "NRXL3AALS10000102" },
    { ...musoshi, shortDescription: "Motocicleta eléctrica" },
    { ...musoshi, longDescription: "Descripción no corroborada" },
    { ...musoshi, specs: { ...musoshi.specs, "Matrícula": "2722MHH" } },
    { ...musoshi, specs: { ...musoshi.specs, "Nº de serie": "NRXL3AALS10000102" } }
  ];
  for (const [index, changed] of variants.entries()) {
    const collision = findSerialNumberCollisions([changed, zero])[0];
    if (collision) assert.equal(verifiedMusoshiSerialOwner(collision), null, String(index));
    if (changed.serialNumber === musoshi.serialNumber && changed.providerId === "gam" && changed.reference === "6806") {
      const batch = prepareImportBatch([changed, zero], catalog);
      assert.equal(batch.products[0]?.status, "review", String(index));
    }
  }
});

test("identidad o evidencia Zero alteradas no permiten eludir el bloqueo", () => {
  const variants: readonly ProductRecord[] = [
    { ...zero, url: `${zero.url}?changed=1` },
    { ...zero, reference: "6808" },
    { ...zero, externalReference: "INQ-04289" },
    { ...zero, model: "DS 15" },
    { ...zero, title: "ZERO S" },
    { ...zero, year: "2024" },
    { ...zero, serialNumber: "538SDJZ6NPCG12345" },
    { ...zero, longDescription: "Otro vehículo" },
    { ...zero, specs: { ...zero.specs, "Matrícula": "3009MMS" } }
  ];
  for (const [index, changed] of variants.entries()) {
    const collision = findSerialNumberCollisions([musoshi, changed])[0];
    if (!collision) continue;
    assert.equal(verifiedMusoshiSerialOwner(collision), null, String(index));
    const batch = prepareImportBatch([musoshi, changed], catalog);
    assert.equal(batch.products[0]?.status, "review", String(index));
  }
});

test("una tercera ficha con el mismo VIN vuelve a bloquear la colisión completa", () => {
  const third = { ...zero, reference: "6808" };
  const collision = getCollision([musoshi, zero, third]);
  assert.equal(verifiedMusoshiSerialOwner(collision), null);
  const batch = prepareImportBatch([musoshi, zero, third], catalog);
  assert.deepEqual(batch.totals, { ready: 0, review: 3 });
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { findSerialNumberCollisions } from "../../identity-conflicts.js";
import { verifiedYaleErp35vlSerialOwner } from "../mapping/providers/gam/yale-erp35vl-serial-evidence.js";
import { prepareImportBatch } from "../preparation/batch-identity.js";

const catalog = await loadImportCatalog();
const [gam, gomariz, mercaeleva] = await Promise.all([
  readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json"),
  readCanonicalCatalog("storage/scraped/gomariz/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json")
]);
const byReference = (reference: string): ProductRecord => {
  const record = gam.products.find((entry) => entry.reference === reference);
  assert.ok(record, reference);
  return record;
};
const older = byReference("6835");
const accredited = byReference("6858");
const collisionFor = (products: readonly ProductRecord[]) =>
  findSerialNumberCollisions(products).find((item) => item.serialNumber === "A976B08243T");

test("F42/F45: ambas publicaciones acreditadas conservan el mismo VIN sin bloqueo", () => {
  const original = structuredClone([older, accredited]);
  const collision = collisionFor([accredited, older]);
  assert.ok(collision);
  assert.strictEqual(verifiedYaleErp35vlSerialOwner(collision), accredited);
  const result = prepareImportBatch([older, accredited], catalog);
  assert.deepEqual(result.totals, { ready: 2, review: 0 });
  assert.equal(result.products[0]?.status, "ready");
  assert.deepEqual(result.products[0]?.issues, []);
  assert.equal(result.products[1]?.status, "ready");
  assert.deepEqual(result.products[1]?.issues, []);
  assert.deepEqual(result.products[0]?.product.spec, older.specs);
  assert.deepEqual(result.products[1]?.product.spec, accredited.specs);
  assert.equal(result.products[1]?.product.reference, "6858");
  assert.deepEqual([older, accredited], original);
});

test("F42: variantes de la ficha acreditada mantienen el bloqueo por colisión", () => {
  const variants: readonly ProductRecord[] = [
    { ...accredited, url: `${accredited.url}?variant=1` },
    { ...accredited, providerId: "gomariz" },
    { ...accredited, externalReference: "GAM" },
    { ...accredited, title: "Otro modelo" },
    { ...accredited, brand: "HYSTER" },
    { ...accredited, model: "ERP30VL" },
    { ...accredited, year: "2018" },
    { ...accredited, price: "25000" },
    { ...accredited, location: "MURCIA" },
    { ...accredited, categoryKey: "maquinaria" },
    { ...accredited, shortDescription: "Texto no acreditado" },
    { ...accredited, longDescription: "Texto comercial cambiado" },
    { ...accredited, specs: { ...accredited.specs, "Horómetro": "1699 horas" } },
    { ...accredited, specs: { ...accredited.specs, "Nº de serie": "A976B08244T" } }
  ];
  for (const [index, changed] of variants.entries()) {
    const collision = collisionFor([older, changed]);
    if (!collision) continue;
    assert.equal(verifiedYaleErp35vlSerialOwner(collision), null, String(index));
    const prepared = prepareImportBatch([older, changed], catalog);
    assert.equal(prepared.products[1]?.status, "review", String(index));
  }
});

test("F42: modificar la ficha vecina impide la excepción", () => {
  const variants: readonly ProductRecord[] = [
    { ...older, url: `${older.url}?variant=1` },
    { ...older, externalReference: "GAM-27262" },
    { ...older, title: "Otro título" },
    { ...older, model: "ERP25VL" },
    { ...older, categoryKey: "maquinaria" },
    { ...older, shortDescription: "Descripción distinta" },
    { ...older, specs: { ...older.specs, "Horómetro": "1663 horas" } },
    { ...older, specs: { ...older.specs, "Nº de serie": "A976B08244T" } }
  ];
  for (const [index, changed] of variants.entries()) {
    const collision = collisionFor([changed, accredited]);
    if (!collision) continue;
    assert.equal(verifiedYaleErp35vlSerialOwner(collision), null, String(index));
    const prepared = prepareImportBatch([changed, accredited], catalog);
    assert.equal(prepared.products[1]?.status, "review", String(index));
  }
});

test("F42: tres coincidencias de VIN no quedan autorizadas por esta acreditación", () => {
  const third = { ...older, reference: "6999" };
  const collision = collisionFor([older, accredited, third]);
  assert.ok(collision);
  assert.equal(verifiedYaleErp35vlSerialOwner(collision), null);
  assert.deepEqual(prepareImportBatch([older, accredited, third], catalog).totals, { ready: 0, review: 3 });
});

test("F42: los tres catálogos conservan 1369 referencias y tres reviews reales", () => {
  const prepared = [gam, gomariz, mercaeleva].map(({ products }) => prepareImportBatch(products, catalog));
  assert.deepEqual(prepared.map(({ totals }) => totals), [
    { ready: 1006, review: 2 },
    { ready: 143, review: 0 },
    { ready: 217, review: 1 }
  ]);
  const products = prepared.flatMap(({ products }) => products);
  assert.equal(products.length, 1369);
  assert.equal(new Set(products.map(({ product }) => `${product.providerId}:${product.reference}`)).size, 1369);
  assert.equal(products.find(({ product }) => product.reference === "6858")?.status, "ready");
  for (const reference of ["6682", "6703", "M827-8304"]) {
    assert.equal(products.find(({ product }) => product.reference === reference)?.status, "review", reference);
  }
});

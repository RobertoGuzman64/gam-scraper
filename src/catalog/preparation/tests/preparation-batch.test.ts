import assert from "node:assert/strict";
import test from "node:test";
import { prepareImportBatch } from "../prepare.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { base, url } from "./preparation-fixtures.js";

test("el batch separa preparados y revisión sin perder referencias", async () => {
  const catalog = await loadImportCatalog();
  const prepared = prepareImportBatch([base, { ...base, reference: "TE9999", price: null }], catalog);
  assert.deepEqual(prepared.totals, { ready: 2, review: 0 });
  assert.equal(prepared.products[1]?.product.reference, "TE9999");
});

test("serie compartida con referencias diferentes exige revisión solo de las fichas afectadas", async () => {
  const catalog = await loadImportCatalog();
  const a = { ...base, serialNumber: "SN-COMPARTIDO" };
  const b = { ...base, reference: "M044-4094", url: `${url}-2`, serialNumber: "sn-compartido" };
  const other = { ...base, reference: "M044-4095", url: `${url}-3`, serialNumber: "OTRO" };
  const batch = prepareImportBatch([a, b, other], catalog);
  assert.deepEqual(batch.totals, { ready: 1, review: 2 });
  for (const entry of batch.products.slice(0, 2)) {
    assert.equal(entry.status, "review");
    assert.ok(entry.issues.some((issue) => issue.includes("Número de serie") && issue.includes("M044-4093") && issue.includes("M044-4094")));
  }
  assert.equal(batch.products[2]?.status, "ready");
  assert.equal(batch.products[0]?.product.reference, "M044-4093");
  assert.equal(batch.products[1]?.product.reference, "M044-4094");
});

test("referencias repetidas en el lote se bloquean durante preparación sin perder productos", async () => {
  const catalog = await loadImportCatalog();
  const other = { ...base, reference: "m044-4093", url: `${url}-otra-unidad`, serialNumber: "OTRA-SERIE" };
  const distinct = { ...base, reference: "M044-4096", url: `${url}-tercera-unidad` };
  const prepared = prepareImportBatch([base, other, distinct], catalog);
  assert.deepEqual(prepared.totals, { ready: 1, review: 2 });
  for (const entry of prepared.products.slice(0, 2)) {
    assert.ok(entry.issues.some((issue) => issue.includes("Referencia duplicada en la extracción")));
    assert.equal(entry.status, "review");
  }
  assert.equal(prepared.products[2]?.product.reference, "M044-4096");
  assert.equal(prepared.products[2]?.status, "ready");
});

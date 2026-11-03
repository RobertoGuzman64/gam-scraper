import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";

const [gam, mercaeleva] = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);
const find = (products: readonly ProductRecord[], reference: string): ProductRecord => {
  const record = products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Las cuatro diferencias técnicas conservan transformaciones acreditadas del origen", () => {
  const battery = find(gam.products, "2219");
  const batteryBefore = JSON.stringify(battery);
  const batteryPrepared = prepareSourceProduct(battery);
  assert.equal(battery.specs?.["Ancho promedio"], "24V / 840-1000Ah(V/Ah)");
  assert.equal(batteryPrepared.product.spec["Ancho promedio"], undefined);
  assert.equal(batteryPrepared.product.spec["Voltaje batería (V)"], "24 V");
  assert.equal(batteryPrepared.product.spec["Capacidad de la batería (Ah)"], "840-1000 Ah");
  assert.equal(batteryPrepared.product.spec.Anchura, "1056 mm");
  assert.equal(JSON.stringify(battery), batteryBefore);

  const zero = find(gam.products, "6807");
  const musoshi = find(gam.products, "6806");
  const zeroBefore = JSON.stringify(zero);
  assert.equal(zero.specs?.["Nº de serie"], "NRXL3AALS10000101");
  assert.equal(musoshi.specs?.["Nº de serie"], "NRXL3AALS10000101");
  const zeroPrepared = prepareSourceProduct(zero);
  assert.equal(zeroPrepared.product.spec["Nº de serie"], undefined);
  assert.equal(zeroPrepared.product.spec.Matrícula, "2722MHH");
  assert.equal(zeroPrepared.product.spec.Kilómetros, "5837 KM");
  assert.equal(JSON.stringify(zero), zeroBefore);

  for (const [reference, wrongHours, mileage, statement] of [
    ["M329-6156", "73 883 h", "73 883 km", "KM 73883"],
    ["M502-4867", "42 922 h", "42 922 km", "KM 42922"]
  ] as const) {
    const original = find(mercaeleva.products, reference);
    const before = JSON.stringify(original);
    assert.equal(original.specs?.["Horas laborales"], wrongHours);
    assert.ok(original.longDescription?.includes(statement), reference);
    const prepared = prepareSourceProduct(original);
    assert.equal(prepared.product.spec["Horas laborales"], undefined, reference);
    assert.equal(prepared.product.spec.Kilometraje, mileage, reference);
    assert.equal(prepared.product.spec["Altura de trabajo"], original.specs?.["Altura de trabajo"], reference);
    assert.equal(JSON.stringify(original), before, reference);
  }
});

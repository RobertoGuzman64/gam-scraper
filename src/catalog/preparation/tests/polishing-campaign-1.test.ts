import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reconcileGamSourceIdentity } from "../reconciliation/gam-source-identity.js";
import { reconcileGamVerifiedHysterH45fts5Title } from "../reconciliation/gam-hyster-h45fts5.js";
import { reconcileGamSourceCapacitySummary } from "../reconciliation/gam-source-capacity-summary.js";
import { reconcileGamVerifiedBasketSizes } from "../reconciliation/gam-verified-basket-sizes.js";

const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");

const source = (reference: string): ProductRecord => {
  const record = products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Ocho dimensiones verificadas se recuperan sin modificar los originales", () => {
  for (const [reference, dimension] of [
    ["6607", "1,83 x 0,76 m"],
    ["6630", "1,8 x 0,8 m"], ["6632", "1,8 x 0,8 m"],
    ["6614", "3,81 x 2,18 m"], ["6615", "3,81 x 2,18 m"], ["6616", "3,81 x 2,18 m"],
    ["6617", "1,83 x 0,76 m"], ["6631", "1,2 x 0,96 m"]
  ] as const) {
    const record = source(reference);
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Dimensiones Cesta"], dimension, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(JSON.stringify(record), original, reference);
  }
});

test("Ocho variantes de modelo respaldadas por título, resumen y URL sustituyen únicamente spec", () => {
  for (const [reference, model] of [
    ["6863", "ERP16VT MWB"], ["3132", "H4.5UT"], ["2020", "E2.0XN"],
    ["2118", "R1.6N"], ["2145", "P2.5"], ["2160", "H10XD-ECD8"],
    ["2171", "H9XD-EC8"], ["2170", "H9XD-EC7"]
  ] as const) {
    const record = source(reference);
    const prepared = prepareSourceProduct(record);
    assert.notEqual(record.specs?.Modelo, model, reference);
    assert.equal(prepared.product.spec.Modelo, model, reference);
    assert.equal(prepared.status, "ready", reference);
  }
});

test("Cuatro marcas reconciliadas exigen evidencia coincidente del mismo producto", () => {
  for (const [reference, brand] of [
    ["6103", "HYSTER"], ["6852", "YALE"], ["6002", "HYSTER"], ["6003", "HYSTER"]
  ] as const) {
    const record = source(reference);
    const prepared = prepareSourceProduct(record);
    assert.notEqual(record.specs?.Marca, brand, reference);
    assert.equal(prepared.product.spec.Marca, brand, reference);
    assert.equal(prepared.status, "ready", reference);
  }
});

test("Dos capacidades publicadas se corrigen preservando la descripción larga acreditada", () => {
  for (const [reference, capacity] of [["2089", "5000"], ["50", "1400"]] as const) {
    const record = source(reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.ok(prepared.product.description?.includes(`Capacidad de carga de ${capacity} kg`), reference);
    assert.ok(!prepared.product.description?.includes("Capacidad de carga de 5500 kg"), reference);
    assert.equal(prepared.product.spec["Capacidad de carga (kg)"], `${capacity} KG`, reference);
  }
});

test("Las dos identidades Hyster se concilian por unidad sin modificar los originales", () => {
  for (const reference of ["6666", "5258"]) {
    const record = source(reference);
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec.Modelo, "H4.5FTS5", reference);
    assert.ok(prepared.product.title?.includes("H4.5FTS5"), reference);
    assert.equal(JSON.stringify(record), original, reference);
  }
});

test("Los reconciliadores rechazan fuentes o identidades manipuladas", () => {
  const basket = source("6630");
  const alteredUrl = { ...basket, url: `${basket.url}?unknown=1` };
  assert.strictEqual(reconcileGamVerifiedBasketSizes(alteredUrl), alteredUrl);
  const alteredModel = { ...basket, specs: { ...basket.specs, Modelo: "VARIANTE DIFERENTE" } };
  assert.strictEqual(reconcileGamVerifiedBasketSizes(alteredModel), alteredModel);

  for (const reference of ["5258", "6666"]) {
    const record = source(reference);
    const wrongUrl = { ...record, url: `${record.url}?version=2` };
    assert.strictEqual(reconcileGamVerifiedHysterH45fts5Title(wrongUrl), wrongUrl);
    assert.equal(prepareSourceProduct(wrongUrl).status, "review", reference);
    const wrongSerial = { ...record, specs: { ...record.specs, "Nº de serie": "OTRA SERIE" } };
    assert.strictEqual(reconcileGamVerifiedHysterH45fts5Title(wrongSerial), wrongSerial);
  }

  const identity = source("3132");
  const alteredIdentity = { ...identity, shortDescription: "Resumen genérico" };
  assert.strictEqual(reconcileGamSourceIdentity(alteredIdentity), alteredIdentity);

  const capacity = source("2089");
  const alteredCapacity = { ...capacity, url: `${capacity.url}?version=2` };
  assert.strictEqual(reconcileGamSourceCapacitySummary(alteredCapacity), alteredCapacity);
});

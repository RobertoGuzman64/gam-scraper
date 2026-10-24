import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const power = catalog.attributes.find((attribute) => attribute.name === "Potencia");
assert.ok(power);
const generator = source.products.find((product) => product.reference === "1211");
assert.ok(generator);

const resolution = (record: ProductRecord) => resolveAttribute(record, power);
const rejected = (record: ProductRecord): void => {
  assert.deepEqual(resolution(record), { status: "rejected", value: null });
  assert.ok(prepareProduct(record, catalog).issues.includes("Atributo rechazado por seguridad: Potencia"));
};

test("GAM: potencia nominal explícita compatible con emergencia y continuo conserva ambos regímenes de origen", () => {
  const specs = JSON.stringify(generator.specs);
  const prepared = prepareProduct(generator, catalog);
  assert.deepEqual(resolution(generator), { status: "resolved", value: 80 });
  assert.equal(prepared.status, "ready");
  assert.ok(prepared.product.attributes.some((attribute) => attribute.value === 80 && attribute.attributeID === power.id));
  assert.equal(JSON.stringify(prepared.product.spec), specs);
  assert.equal(JSON.stringify(generator.specs), specs);
  assert.match(prepared.product.description ?? "", /Potencia Emergencia: 83\.0 Kva/);
  assert.match(prepared.product.description ?? "", /Potencia continuo: 78\.0 Kva/);
});

test("GAM: un valor diferente sin régimen publicado sigue rechazado", () => {
  rejected({ ...generator, shortDescription: `${generator.shortDescription ?? ""} Potencia: 92 kVA.` });
  rejected({ ...generator, shortDescription: "Grupo electrógeno de 83 kVA y 78 kVA." });
  rejected({ ...generator, shortDescription: "Potencia Emergencia: 83.0 kWA. Potencia continuo: 78.0 kVA." });
});

test("GAM: los regímenes incompletos, repetidos o invertidos siguen rechazados", () => {
  rejected({ ...generator, shortDescription: "Potencia Emergencia: 83.0 kVA." });
  rejected({ ...generator, shortDescription: "Potencia Emergencia: 83.0 kVA. Potencia Emergencia: 78.0 kVA." });
  rejected({ ...generator, shortDescription: "Potencia Emergencia: 78.0 kVA. Potencia continuo: 83.0 kVA." });
});

test("GAM: la resolución exige coherencia de marca, modelo y familia", () => {
  rejected({ ...generator, model: "GSW110V" });
  const otherFamily = { ...generator, url: generator.url.replace("grupos-electrogenos-nuevos", "carretillas-segunda-mano") };
  const otherCategory = { ...generator, categoryKey: "manutencion" };
  assert.equal(resolution(otherFamily).status, "invalid");
  assert.equal(resolution(otherCategory).status, "invalid");
  assert.ok(!prepareProduct(otherFamily, catalog).product.attributes.some((attribute) => attribute.attributeID === power.id));
  assert.ok(!prepareProduct(otherCategory, catalog).product.attributes.some((attribute) => attribute.attributeID === power.id));
});

test("GAM: las discrepancias expresadas en unidades válidas siguen rechazadas", () => {
  for (const reference of ["6834"]) {
    const item = source.products.find((product) => product.reference === reference);
    assert.ok(item, reference);
    rejected(item);
  }
});

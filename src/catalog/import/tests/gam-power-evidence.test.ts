import assert from "node:assert/strict";
import test from "node:test";
import { requireProductReference } from "./require-product-reference.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const attribute = (name: string) => {
  const result = catalog.attributes.find((entry) => entry.name === name);
  assert.ok(result, name);
  return result;
};
const reference = (id: string): ProductRecord => requireProductReference(source.products, id);
const power = (record: ProductRecord) => resolveAttribute(record, attribute("Potencia"));

test("PRAMAC publicado bajo /pramac conserva la potencia de motor separada", () => {
  const record = reference("1213");
  assert.equal(record.categoryKey, "otros-nuevos");
  assert.match(record.url, /\/es\/pramac\//);
  assert.deepEqual(power(record), { status: "resolved", value: 165 });
  assert.equal(prepareProduct(record, catalog).status, "ready");
  assert.equal(record.specs?.["Potencia Motor (KW)"], "148 / 140");
});

test("solo acepta la ruta PRAMAC cuando coinciden el modelo y la potencia del grupo", () => {
  const original = reference("1213");
  const matching = { ...original, shortDescription: "Grupo electrógeno nuevo PRAMAC GSW165P 165 kVA" };
  assert.deepEqual(power(matching), { status: "resolved", value: 165 });
  for (const record of [
    { ...matching, model: "GSW200P" },
    { ...matching, specs: { ...matching.specs, Modelo: "GSW200P" } },
    { ...matching, specs: { ...matching.specs, Marca: "OTRA" } },
    { ...matching, brand: "OTRA" },
    { ...matching, categoryKey: "marcas-nuevas" },
    { ...matching, providerId: "gomariz" },
    { ...matching, url: matching.url.replace("online.gamrentals.com", "otro-proveedor.example") },
    { ...matching, url: matching.url.replace("/pramac/", "/otro/") },
    { ...matching, title: "Grupo electrógeno PRAMAC GSW165P 165 kW" },
    { ...matching, longDescription: "Grupo PRAMAC GSW165P con potencia del grupo de 190 kVA." },
    { ...matching, specs: { ...matching.specs, Potencia: "190 kVA" } }
  ]) assert.notDeepEqual(power(record), { status: "resolved", value: 165 });
});

test("la potencia no acreditada sigue rechazada y las nominales se conservan", () => {
  assert.deepEqual(power(reference("6834")), { status: "resolved", value: 32 });
  assert.equal(prepareProduct(reference("6834"), catalog).status, "ready");
  assert.deepEqual(power(reference("1214")), { status: "resolved", value: 200 });
  assert.deepEqual(power(reference("1211")), { status: "resolved", value: 80 });
});

test("no transforma un horómetro mezclado con un identificador en horas válidas", () => {
  const record = reference("6775");
  assert.equal(record.horometer, "NA V72309090022 horas");
  assert.equal(resolveAttribute(record, attribute("Horas de uso")).status, "not_observed");
  assert.equal(prepareProduct(record, catalog).status, "ready");
});

import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));
const reference = (code: string) => {
  const record = source.products.find((product) => product.reference === code);
  assert.ok(record, code);
  return record;
};
const attribute = (name: string) => {
  const found = catalog.attributes.find((item) => item.name === name);
  assert.ok(found, name);
  return found;
};
const status = (code: string, name: string) => resolveAttribute(reference(code), attribute(name)).status;

test("GAM: capacidades incompatibles de una ficha con modelo explícito siguen bloqueadas", () => {
  for (const code of ["6965", "6932", "6723", "2211", "2275", "2193", "6421"]) {
    assert.equal(status(code, "Capacidad de carga"), "contradiction", code);
  }
});

test("GAM: discrepancias de capacidad en descripción corta de modelo confirmado no pasan a ready", () => {
  for (const code of ["2089", "2049", "2044", "6272", "2016", "50", "2136"]) {
    assert.equal(status(code, "Capacidad de carga"), "contradiction", code);
  }
});

test("GAM: descripción ajena al modelo o capacidad opcional no invalida la especificación", () => {
  const original = reference("2089");
  assert.equal(resolveAttribute({ ...original, shortDescription: "Carretilla HYSTER H4.0FT con capacidad de carga de 5500 kg" }, attribute("Capacidad de carga")).status, "resolved");
  assert.equal(resolveAttribute({ ...original, shortDescription: "HYSTER H5.0FT con capacidad de carga de hasta 5500 kg" }, attribute("Capacidad de carga")).status, "resolved");
  assert.equal(resolveAttribute({ ...original, shortDescription: "HYSTER H5.0FT con capacidad de carga de 5000 o 5500 kg" }, attribute("Capacidad de carga")).status, "resolved");
});

test("GAM: alturas, anchos y radios de giro ambiguos conservan sus rechazos", () => {
  for (const code of ["6702", "5275", "6887", "5864", "3134", "6236", "6764"]) {
    assert.equal(status(code, "Altura de elevación"), "contradiction", code);
  }
  for (const code of ["4024", "3997", "4005", "4004"]) {
    assert.equal(status(code, "Ancho de trabajo"), "contradiction", code);
  }
  for (const code of ["2285", "2286", "2287", "2288", "2289", "2290", "5996"]) {
    assert.equal(status(code, "Radio de giro"), "invalid", code);
  }
});

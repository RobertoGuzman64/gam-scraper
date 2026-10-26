import assert from "node:assert/strict";
import test from "node:test";
import { requireProductReference } from "./require-product-reference.js";
import { fileURLToPath } from "node:url";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));
const reference = (code: string) => requireProductReference(source.products, code);
const attribute = (name: string) => {
  const found = catalog.attributes.find((item) => item.name === name);
  assert.ok(found, name);
  return found;
};
const status = (code: string, name: string) => resolveAttribute(reference(code), attribute(name)).status;

test("GAM: capacidades acreditadas por el modelo y contradicciones pendientes se distinguen", () => {
  for (const code of ["6965", "6932", "2275", "2193", "6421"]) {
    assert.equal(status(code, "Capacidad de carga"), "resolved", code);
  }
  for (const code of ["6723", "2211"]) {
    assert.equal(status(code, "Capacidad de carga"), "contradiction", code);
  }
});

test("GAM: capacidades corroboradas y descripción corta sin confirmar se distinguen", () => {
  for (const code of ["2089", "2049", "2044", "2016", "50", "2136"]) {
    assert.equal(status(code, "Capacidad de carga"), "resolved", code);
  }
  assert.equal(status("6272", "Capacidad de carga"), "contradiction");
});

test("GAM: descripción ajena al modelo o capacidad opcional no invalida la especificación", () => {
  const original = reference("2089");
  assert.equal(resolveAttribute({ ...original, shortDescription: "Carretilla HYSTER H4.0FT con capacidad de carga de 5500 kg" }, attribute("Capacidad de carga")).status, "resolved");
  assert.equal(resolveAttribute({ ...original, shortDescription: "HYSTER H5.0FT con capacidad de carga de hasta 5500 kg" }, attribute("Capacidad de carga")).status, "resolved");
  assert.equal(resolveAttribute({ ...original, shortDescription: "HYSTER H5.0FT con capacidad de carga de 5000 o 5500 kg" }, attribute("Capacidad de carga")).status, "resolved");
});

test("GAM: alturas, anchos y radios de giro ambiguos conservan sus rechazos", () => {
  for (const code of ["6702", "5275", "6887", "5864", "3134", "6764"]) {
    assert.equal(status(code, "Altura de elevación"), "contradiction", code);
  }
  assert.equal(status("6236", "Altura de elevación"), "rejected");
  for (const code of ["4024", "3997", "4005"]) {
    assert.equal(status(code, "Ancho de trabajo"), "resolved", code);
  }
  assert.equal(status("4004", "Ancho de trabajo"), "resolved");
  for (const code of ["2285", "2286", "2289", "2290"]) {
    assert.equal(status(code, "Radio de giro"), "not_observed", code);
  }
  for (const code of ["2287", "2288", "5996"]) {
    assert.equal(status(code, "Radio de giro"), "not_observed", code);
  }
});

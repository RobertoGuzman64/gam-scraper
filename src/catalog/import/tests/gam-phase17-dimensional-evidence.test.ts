import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("storage/scraped/gam/scrape-gam-marzo-2026-catalog.json");
const reference = (id: string): ProductRecord => {
  const record = source.products.find((product) => product.reference === id);
  assert.ok(record, id);
  return record;
};
const attribute = (name: string) => {
  const value = catalog.attributes.find((entry) => entry.name === name);
  assert.ok(value, name);
  return value;
};
const width = (record: ProductRecord) => resolveAttribute(record, attribute("Ancho de trabajo"));

test("Fase 17: distingue ancho de bayeta y anchura de limpieza en la configuración T500e D80", () => {
  const record = reference("4002");
  assert.equal(record.specs?.["Anchura trabajo"], "1,23 metros");
  assert.deepEqual(width(record), { status: "resolved", value: 800 });
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.issues.length, 0);
  assert.equal(record.specs?.["Anchura trabajo"], "1,23 metros");
});

test("Fase 17: si falta evidencia de configuración, medidas o identidad, conserva el conflicto", () => {
  const original = reference("4002");
  const differentModel = { ...original, model: "FCA T500e D65" };
  const wrongTitle = { ...original, title: "Fregadora TENNANT FCA T500e D65" };
  const withoutRange = { ...original, longDescription: (original.longDescription ?? "").replace("650 mm y 800 mm", "800 mm") };
  const differentBayeta = { ...original, longDescription: (original.longDescription ?? "").replace("1.234 mm", "1.100 mm") };
  const otherSpec = { ...original, specs: { ...original.specs, "Anchura trabajo": "1,1 metros" } };
  const otherProvider = { ...original, providerId: "gomariz" };
  const noDescription = { ...original, longDescription: "" };
  const additionalSource = { ...original, specs: { ...original.specs, "Ancho de trabajo": "900 mm" } };
  const withoutSuffix = { ...original, model: "FCA T500e" };
  const contradictoryDescription = {
    ...original,
    longDescription: `${original.longDescription ?? ""}. FCA T500e D80 con ancho de fregado de 900 mm.`
  };
  for (const example of [differentModel, wrongTitle, withoutRange, differentBayeta, otherSpec, additionalSource, withoutSuffix, contradictoryDescription]) {
    assert.equal(width(example).status, "contradiction");
  }
  assert.deepEqual(width(otherProvider), { status: "resolved", value: 1230 });
  assert.deepEqual(width(noDescription), { status: "resolved", value: 1230 });
});

test("Fase 17: anchuras corroboradas se recuperan sin liberar la discrepancia de T581 55", () => {
  for (const [id, value] of [["4024", 860], ["3997", 455], ["4005", 700]] as const) {
    assert.deepEqual(width(reference(id)), { status: "resolved", value }, id);
    assert.equal(prepareProduct(reference(id), catalog).status, "ready", id);
  }
  assert.deepEqual(width(reference("4004")), { status: "resolved", value: 800 });
  assert.equal(prepareProduct(reference("4004"), catalog).status, "ready");
});

test("Fase 17: alturas incongruentes, medidas variables de mástil y radios con alternativas no se liberan", () => {
  for (const id of ["6702", "5275", "6887", "5864", "3134"]) {
    const record = reference(id);
    assert.equal(resolveAttribute(record, attribute("Altura de elevación")).status, "contradiction", id);
    assert.equal(prepareProduct(record, catalog).status, ["3134", "6702", "5275", "5864", "6887"].includes(id) ? "ready" : "review", id);
  }
  for (const id of ["18", "2130"]) {
    assert.equal(resolveAttribute(reference(id), attribute("Altura de elevación")).status, "not_observed", id);
  }
  assert.equal(resolveAttribute(reference("18"), attribute("Tipo de mástil")).status, "not_observed");
  for (const id of ["2285", "2286", "2289", "2290"]) {
    const record = reference(id);
    assert.equal(resolveAttribute(record, attribute("Radio de giro")).status, "not_observed", id);
    assert.equal(prepareProduct(record, catalog).status, "ready", id);
    assert.equal(prepareProduct(record, catalog).product.spec["Radio de giro"], record.specs?.["Radio de giro"]);
  }
  for (const id of ["2287", "2288", "5996"]) {
    const record = reference(id);
    assert.equal(resolveAttribute(record, attribute("Radio de giro")).status, "not_observed", id);
    assert.equal(prepareProduct(record, catalog).status, "ready", id);
  }
});

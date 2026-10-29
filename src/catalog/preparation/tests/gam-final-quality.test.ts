import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";
import { prepareImportBatch } from "../batch-identity.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { SOURCE_TECHNICAL_FIELDS } from "../source/technical-fields.js";

const source = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const catalog = await loadImportCatalog();
const original = (reference: string) => {
  const value = source.products.find((record) => record.reference === reference);
  assert.ok(value, reference);
  return value;
};
const field = (name: string) => {
  const value = SOURCE_TECHNICAL_FIELDS.find((entry) => entry.name === name);
  assert.ok(value, name);
  return value;
};

test("GAM conserva las variantes de carga Tecnacar sin asignar una capacidad ficticia", () => {
  for (const reference of ["293", "294", "295", "296"]) {
    const product = original(reference);
    assert.deepEqual(resolveAttribute(product, field("Capacidad de carga")), { status: "not_observed", value: null });
    assert.equal(prepareProduct(product, catalog).status, "ready", reference);
    assert.equal(product.specs?.["Capacidad de carga (kg)"], "1500 / 2000 KG");
    assert.equal(resolveAttribute({ ...product, model: "Diferente" }, field("Capacidad de carga")).status, "invalid");
  }
});

test("GAM no transforma una referencia dimensional errónea de Yale en altura real", () => {
  const product = original("1714");
  assert.deepEqual(resolveAttribute(product, field("Altura de plataforma")), { status: "not_observed", value: null });
  assert.equal(prepareProduct(product, catalog).status, "ready");
  assert.equal(product.specs?.["Altura Plataforma"], "4.8mm metros");
  assert.equal(resolveAttribute({ ...product, model: "MS20X" }, field("Altura de plataforma")).status, "invalid");
});

test("GAM reconoce capacidades separadas BRAVI y potencia publicada con separador malformado TECNA", () => {
  const bravi = original("157");
  const tecnacar = original("287");
  assert.deepEqual(resolveAttribute(bravi, field("Capacidad de carga")), { status: "resolved", value: 130 });
  assert.deepEqual(resolveAttribute(tecnacar, field("Potencia")), { status: "resolved", value: 25 });
  assert.equal(prepareProduct(bravi, catalog).status, "ready");
  assert.equal(prepareProduct(tecnacar, catalog).status, "ready");
  assert.equal(resolveAttribute({ ...bravi, shortDescription: "Sin capacidad comprobada" }, field("Capacidad de carga")).status, "invalid");
  assert.equal(resolveAttribute({ ...tecnacar, model: "VTA 420" }, field("Potencia")).status, "invalid");
});

test("GAM termina con exactamente dos reviews de identidad que siguen excluidas", () => {
  const reviewed = prepareImportBatch(source.products, catalog).products.filter((product) => product.status === "review")
    .map((product) => product.product.reference).sort();
  assert.deepEqual(reviewed, ["6682", "6703"]);
});

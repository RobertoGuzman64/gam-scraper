import { accreditedSourceSamples } from "../../../../testing/domain-cases/accredited-source-samples.js";
import assert from "node:assert/strict";
import test from "node:test";
import { requireProductReference } from "../../../testing/require-product-reference.js";
import { fileURLToPath } from "node:url";
import { loadImportCatalog } from "../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../../../shared/classification/mapping/attribute-mapping.js";
import { prepareProduct } from "../../../../commercial/legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const source = { products: accreditedSourceSamples("gam-historical") };
const reference = (code: string) => requireProductReference(source.products, code);
const attribute = (name: string) => {
  const found = catalog.attributes.find((item) => item.name === name);
  assert.ok(found, name);
  return found;
};

test("GAM: variante 70 y especificación coinciden con una de dos anchuras explícitas", () => {
  const selected = reference("4000");
  assert.deepEqual(resolveAttribute(selected, attribute("Ancho de trabajo")), { status: "resolved", value: 700 });
  const result = prepareProduct(selected, catalog);
  assert.ok(!result.issues.includes("Atributo contradictorio: Ancho de trabajo"));
  assert.equal(result.status, "ready");
  assert.equal(resolveAttribute({ ...selected, model: "FCA T391 60" }, attribute("Ancho de trabajo")).status, "contradiction");
  assert.equal(resolveAttribute({ ...selected, shortDescription: "Fregadora TENNANT FCA T391 60" }, attribute("Ancho de trabajo")).status, "contradiction");
  assert.equal(resolveAttribute({ ...selected, specs: { ...selected.specs, "Anchura trabajo": "0,6 metros" } }, attribute("Ancho de trabajo")).status, "contradiction");
});

test("GAM: anchuras acreditadas y versiones no confirmadas se distinguen", () => {
  for (const code of ["4024", "3997", "4005"]) {
    assert.equal(resolveAttribute(reference(code), attribute("Ancho de trabajo")).status, "resolved", code);
  }
  assert.deepEqual(resolveAttribute(reference("4004"), attribute("Ancho de trabajo")), { status: "resolved", value: 800 });
});

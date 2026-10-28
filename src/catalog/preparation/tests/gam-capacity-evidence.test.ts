import assert from "node:assert/strict";
import test from "node:test";
import { requireProductReference } from "./require-product-reference.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const capacity = catalog.attributes.find((attribute) => attribute.name === "Capacidad de carga");
assert.ok(capacity);
const reference = (id: string): ProductRecord => requireProductReference(source.products, id);
const status = (record: ProductRecord) => resolveAttribute(record, capacity).status;

test("no inventa una capacidad puntual para las dos fichas con alternativas", () => {
  for (const id of ["237", "235"]) {
    const record = reference(id);
    assert.equal(status(record), "not_observed", id);
    assert.equal(prepareProduct(record, catalog).status, "ready", id);
  }
});

test("detecta dos capacidades nominales opuestas dentro de una misma descripción del modelo", () => {
  const original = reference("2089");
  const fixed = {
    ...original,
    title: "Carretilla elevadora diésel Hyster H5.0FT",
    shortDescription: "Hyster H5.0FT diésel",
    longDescription: "La Hyster H5.0FT tiene capacidad de carga de 5.000 kg. La Hyster H5.0FT ofrece capacidad de carga de 4.500 kg."
  };
  assert.equal(status(fixed), "contradiction");
  assert.equal(status({
    ...fixed,
    longDescription: "La Hyster H5.0FT declara capacidad nominal de 5 toneladas y capacidad de carga de 4500 kg."
  }), "contradiction");
  assert.equal(status({
    ...fixed,
    longDescription: "Hyster H5.0FT tiene capacidad de carga de 5000 kg.",
    shortDescription: "Hyster H5.0FT: capacidad de carga de 5000 kg, capacidad de carga de 4500 kg."
  }), "contradiction");
});

test("no confunde rangos, máximos opcionales ni cantidades equivalentes", () => {
  const base = reference("2089");
  const fixed = { ...base, title: "Carretilla elevadora Hyster H5.0FT", shortDescription: "Hyster H5.0FT" };
  for (const description of [
    "Hyster H5.0FT con capacidad de carga de 5000 kg y capacidad nominal de 5 toneladas.",
    "Hyster H5.0FT con capacidad de carga de 5000 kg y capacidad de carga de hasta 5500 kg según configuración.",
    "Hyster H5.0FT con capacidad de carga de 5000 kg y capacidad de carga de 4500/5000 kg dependiendo de la versión.",
    "Hyster H5.0FT con capacidad de carga de 5000 kg y capacidad de carga de 4500 o 5000 kg."
  ]) {
    assert.equal(status({ ...fixed, longDescription: description }), "resolved", description);
  }
});

test("sin identidad de modelo o fuera de GAM no extiende el veto", () => {
  const base = reference("2089");
  const different = {
    ...base,
    title: "Carretilla elevadora Hyster H5.0FT",
    shortDescription: "Hyster H5.0FT",
    longDescription: "La Hyster H4.0FT ofrece capacidad de carga de 4000 kg. La Hyster H4.0FT ofrece capacidad de carga de 4500 kg."
  };
  assert.equal(status(different), "resolved");
  assert.equal(status({ ...different, providerId: "gomariz" }), "resolved");
});

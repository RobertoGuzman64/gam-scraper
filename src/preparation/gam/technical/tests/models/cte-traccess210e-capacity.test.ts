import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { reconcileGamVerifiedCapacityCoherence } from "../../reconciliation/gam-verified-capacity-coherence.js";

const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const original = products.find((product) => product.reference === "6171");

test("CTE TRACCESS 210E: capacidad coherente con las especificaciones y el fabricante", () => {
  assert.ok(original);
  const before = JSON.stringify(original);
  assert.ok(original.shortDescription?.includes("Capacidad de la cesta 200 kg"));
  assert.equal(original.specs?.["Capacidad de carga (kg)"], "230 KG");
  const prepared = prepareSourceProduct(original);
  assert.equal(prepared.status, "ready");
  assert.ok(prepared.product.description?.includes("Capacidad de la cesta 230 kg"));
  assert.ok(!prepared.product.description?.includes("200 kg"));
  assert.ok(prepared.product.description_general?.includes("230 kg"));
  assert.ok(prepared.product.description_general?.includes("11,30 m"));
  assert.ok(!prepared.product.description_general?.includes("200 kg"));
  assert.ok(!prepared.product.description_general?.includes("8,5 m"));
  assert.equal(prepared.product.spec["Capacidad de carga (kg)"], "230 KG");
  assert.equal(prepared.product.spec["Modelo"], "TRCS 210E");
  assert.equal(JSON.stringify(original), before);
});

test("CTE TRACCESS 210E: no se propaga una capacidad a otra variante o a una fuente cambiada", () => {
  assert.ok(original);
  for (const source of [
    { ...original, model: "TRCS 230E" },
    { ...original, specs: { ...original.specs, Modelo: "TRCS 230E" } },
    { ...original, specs: { ...original.specs, "Capacidad de carga (kg)": "200 KG" } },
    { ...original, shortDescription: "CTE TRACCESS 210E sin carga de cesta acreditada" },
    { ...original, longDescription: "CTE TRACCESS 210E sin especificaciones de la cesta" },
    { ...original, url: original.url + "?variante=otra" },
    { ...original, providerId: "gomariz" }
  ]) {
    assert.strictEqual(reconcileGamVerifiedCapacityCoherence(source), source);
  }
});

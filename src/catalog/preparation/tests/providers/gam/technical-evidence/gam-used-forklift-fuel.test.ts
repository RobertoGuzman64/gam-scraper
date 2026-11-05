import { reconcileGamHorometer } from "../../../../reconciliation/gam-horometer.js";
import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGamUsedForkliftFuel } from "../../../../evidence/providers/gam/energy-and-powertrain/used-forklift-fuel-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const sourceOf = (reference: string) => {
  const record = catalog.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera GLP declarado por la misma unidad sin alterar los datos de origen", () => {
  for (const reference of ["6682", "6755", "5714"]) {
    const source = sourceOf(reference);
    const unchanged = structuredClone(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.product.spec["Motorización"], "GLP", reference);
    assert.equal(prepared.status, "ready", reference);
    for (const [key, value] of Object.entries(source.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], key === "Horómetro" ? reconcileGamHorometer(source).specs?.[key] : value, `${reference}: ${key}`);
    }
    assert.deepEqual(source, unchanged);
  }
});

test("rechaza identidades cruzadas, variantes sin acreditar, combustibles contradictorios y campos preexistentes", () => {
  const source = sourceOf("6682");
  const previous = source.specs ?? {};
  for (const altered of [
    { ...source, providerId: "gomariz" },
    { ...source, condition: "Nuevo" as const },
    { ...source, categoryKey: "carretillas-nuevas" },
    { ...source, reference: "9999" },
    { ...source, brand: "YALE" },
    { ...source, model: "H2.5FT" },
    { ...source, url: `${source.url}?variant=other` },
    { ...source, url: source.url.replace("hyster-h35ft", "hyster-h25ft") },
    { ...source, shortDescription: "Carretilla elevadora de ocasión" },
    { ...source, longDescription: `${source.longDescription ?? ""} Motor diésel.` },
    { ...source, specs: { ...previous, Motorización: "Diésel" } },
    { ...source, specs: { ...previous, "Tipo motor": "GLP" } }
  ]) {
    assert.deepEqual(recoverGamUsedForkliftFuel(altered, altered.specs ?? {}), altered.specs ?? {});
  }
  for (const reference of ["5258", "6920", "6644"]) {
    const source = sourceOf(reference);
    assert.deepEqual(recoverGamUsedForkliftFuel(source, source.specs ?? {}), source.specs ?? {}, reference);
  }
});

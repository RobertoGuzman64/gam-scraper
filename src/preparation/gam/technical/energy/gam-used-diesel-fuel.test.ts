import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGamUsedDieselFuel } from "./used-diesel-fuel-evidence.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const sourceOf = (reference: string) => {
  const source = catalog.products.find((record) => record.reference === reference);
  assert.ok(source, reference);
  return source;
};

test("recupera combustible diésel de equipos de ocasión identificados sin alterar la fuente", () => {
  for (const reference of ["6901", "6984", "6024"]) {
    const source = sourceOf(reference);
    const unchanged = structuredClone(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec["Motorización"], "Diésel", reference);
    for (const [key, value] of Object.entries(source.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(source, unchanged);
  }
});

test("no incorpora diésel cuando cambia la identidad, el combustible o falta confirmación", () => {
  const source = sourceOf("6901");
  const specs = source.specs ?? {};
  for (const altered of [
    { ...source, providerId: "gomariz" },
    { ...source, condition: "Nuevo" as const },
    { ...source, reference: "9999" },
    { ...source, model: "A46J" },
    { ...source, brand: "JLG" },
    { ...source, url: `${source.url}?variant=other` },
    { ...source, url: source.url.replace("diesel", "electricas") },
    { ...source, url: source.url.replace("a46jrt", "a46j") },
    { ...source, shortDescription: "Plataforma de ocasión sin motorización acreditada" },
    { ...source, longDescription: `${source.longDescription ?? ""} También disponible con motor eléctrico.` },
    { ...source, longDescription: `${source.longDescription ?? ""} Motorización diésel opcional.` },
    { ...source, longDescription: `${source.longDescription ?? ""} Sin motor diésel.` },
    { ...source, specs: { ...specs, Marca: "JLG" } },
    { ...source, specs: { ...specs, "Motorización": "Eléctrico" } }
  ]) {
    assert.deepEqual(recoverGamUsedDieselFuel(altered, altered.specs ?? {}), altered.specs ?? {});
  }
  assert.deepEqual(recoverGamUsedDieselFuel(source, { ...specs, "Tipo motor": "Diésel" }), { ...specs, "Tipo motor": "Diésel" });
  for (const reference of ["6981", "6622", "6934"]) {
    const another = sourceOf(reference);
    assert.deepEqual(recoverGamUsedDieselFuel(another, another.specs ?? {}), another.specs ?? {}, reference);
  }
});

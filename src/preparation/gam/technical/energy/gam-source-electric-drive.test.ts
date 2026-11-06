import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGamSourceElectricDrive } from "./source-electric-drive-evidence.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const sourceOf = (reference: string) => {
  const source = catalog.products.find((record) => record.reference === reference);
  assert.ok(source, reference);
  return source;
};

test("recupera la motorización eléctrica afirmada por una fuente inequívoca sin alterar sus especificaciones", () => {
  for (const reference of ["4738", "2012", "3443"]) {
    const source = sourceOf(reference);
    const original = structuredClone(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.product.spec["Motorización"], "Eléctrico", reference);
    assert.equal(prepared.status, "ready", reference);
    for (const [key, value] of Object.entries(source.specs ?? {})) {
      const expected = key === "Dimensiones Cesta" && reference === "4738" ? "2,27 x 1,12 m" : value;
      assert.deepEqual(prepared.product.spec[key], expected, `${reference}: ${key}`);
    }
    assert.deepEqual(source, original);
  }
});

test("rechaza otra identidad, una variante cruzada, combustible alternativo y motorización ya informada", () => {
  const source = sourceOf("3443");
  const specs = source.specs ?? {};
  const otherVariant = sourceOf("3442");
  for (const record of [
    { ...source, providerId: "gomariz" },
    { ...source, condition: "Segunda mano" as const },
    { ...source, reference: "9999" },
    { ...source, model: "ELISE 700" },
    { ...source, url: `${source.url}?variant=other` },
    { ...source, url: source.url.replace("elise-900", "elise-700") },
    { ...source, shortDescription: source.shortDescription?.replaceAll("ELISE 900", "ELISE 700") ?? null },
    { ...source, longDescription: `${source.longDescription ?? ""} Disponible en versión diésel.` },
    { ...source, longDescription: `${source.longDescription ?? ""} El motor eléctrico es opcional.` },
    { ...source, specs: { ...specs, "Motorización": "Diésel" } }
  ]) {
    assert.deepEqual(recoverGamSourceElectricDrive(record, specs), specs, record.url);
  }
  assert.deepEqual(recoverGamSourceElectricDrive(otherVariant, otherVariant.specs ?? {}), otherVariant.specs ?? {});
  assert.deepEqual(recoverGamSourceElectricDrive(source, { ...specs, "Tipo motor": "Eléctrico" }), { ...specs, "Tipo motor": "Eléctrico" });
});

import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../normalization/normalize-specs.js";
import { recoverGamSourceRegenerativeBraking } from "../../../../evidence/providers/gam/mobility/source-regenerative-braking.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const sourceOf = (reference: string) => {
  const source = catalog.products.find((product) => product.reference === reference);
  assert.ok(source, reference);
  return source;
};

test("recupera frenado regenerativo explícito de modelos identificados sin alterar la fuente", () => {
  for (const reference of ["2192", "2130", "2794"]) {
    const source = sourceOf(reference);
    const snapshot = structuredClone(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.product.spec["Frenado regenerativo"], true, reference);
    assert.equal(normalizeSpecsObject(prepared.product.spec).normalized["Frenado regenerativo"], true, reference);
    for (const [key, value] of Object.entries(source.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(source, snapshot);
  }
});

test("no convierte declaraciones opcionales, contradictorias o de identidad ajena en prestaciones", () => {
  const source = sourceOf("2192");
  const existing = source.specs ?? {};
  const variants = [
    { ...source, providerId: "gomariz" },
    { ...source, condition: "Segunda mano" as const },
    { ...source, brand: "OTRA" },
    { ...source, model: "OTRO" },
    { ...source, reference: "9999" },
    { ...source, url: `${source.url}?variante=otra` },
    { ...source, longDescription: "Frenos regenerativos." },
    { ...source, longDescription: `${source.longDescription} Sin frenos regenerativos.` },
    { ...source, longDescription: `${source.longDescription} No tiene frenos regenerativos.` },
    { ...source, longDescription: `${source.longDescription} Puede incorporar frenos regenerativos.` },
    { ...source, longDescription: `${source.longDescription} Opción de frenos regenerativos.` },
    { ...source, specs: { ...existing, "Frenado regenerativo": false } }
  ];
  for (const variant of variants) {
    assert.deepEqual(recoverGamSourceRegenerativeBraking(variant, variant.specs ?? {}), variant.specs ?? {});
  }
});

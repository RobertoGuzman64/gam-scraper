import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../normalization/normalize-specs.js";
import { recoverGamVerifiedResidualGeometrySpecs } from "../../../../evidence/providers/gam/measurements-and-capacities/verified-residual-geometry-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const references = [
  "6419", "6425", "6424", "2151", "4623", "2108", "1713", "2102",
  "4798", "4846", "4725", "6743", "6744", "2103", "4024",
  "4017", "4018", "4028", "2649", "5988"
] as const;

const record = (reference: string): ProductRecord => {
  const found = catalog.products.find((item) => item.reference === reference);
  assert.ok(found, reference);
  return found;
};

test("solo las veinte referencias acreditadas reciben nuevas especificaciones", () => {
  const changed: string[] = [];
  for (const source of catalog.products) {
    const original = structuredClone(source);
    const after = recoverGamVerifiedResidualGeometrySpecs(source);
    const added = Object.keys(after).filter((key) => !Object.hasOwn(source.specs ?? {}, key));
    assert.deepEqual(source, original, String(source.reference));
    for (const [key, value] of Object.entries(source.specs ?? {})) {
      assert.deepEqual(after[key], value, String(source.reference));
    }
    if (added.length > 0) {
      changed.push(String(source.reference));
      assert.ok(added.length <= 2);
    }
  }
  assert.deepEqual(new Set(changed), new Set(references));
  assert.equal(changed.length, 20);
});

test("normalización preserva los valores y diferencia pendiente con y sin carga", () => {
  for (const reference of references) {
    const source = record(reference);
    const evidence = recoverGamVerifiedResidualGeometrySpecs(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", reference);
    const normalized = normalizeSpecsObject(prepared.product.spec);
    for (const key of Object.keys(evidence).filter((candidate) => !Object.hasOwn(source.specs ?? {}, candidate))) {
      assert.equal(prepared.product.spec[key], evidence[key], `${reference}: ${key}`);
      assert.ok(!normalized.unknownKeys.includes(key), `${reference}: ${key} no reconocido`);
      assert.ok(normalized.normalized[key] !== undefined, `${reference}: ${key} perdido`);
    }
  }
  const gradient = normalizeSpecsObject(prepareSourceProduct(record("6419")).product.spec).normalized;
  assert.equal(gradient["Pendiente superable con carga (%)"], 16);
  assert.equal(gradient["Pendiente superable sin carga (%)"], 23);
  assert.equal(normalizeSpecsObject(prepareSourceProduct(record("4623")).product.spec).normalized["Pendiente superable sin carga (%)"], 10);
  assert.deepEqual(normalizeSpecsObject(prepareSourceProduct(record("6743")).product.spec).normalized["Dimensiones horquillas (mm)"], { largo: 1180, ancho: 170, grosor: 55 });
  assert.equal(normalizeSpecsObject(prepareSourceProduct(record("4017")).product.spec).normalized["Velocidad de marcha atrás (km/h)"], 6.4);
  assert.equal(normalizeSpecsObject(prepareSourceProduct(record("2649")).product.spec).normalized["Autonomía máxima (h)"], 7);
  assert.equal(normalizeSpecsObject(prepareSourceProduct(record("4028")).product.spec).normalized["Anchura de barrido con dos cepillos laterales (mm)"], 970);
});

test("rechaza referencias, proveedores, modelos, variantes y texto fuente incompatibles", () => {
  for (const reference of references) {
    const source = record(reference);
    const altered: readonly ProductRecord[] = [
      { ...source, providerId: "gomariz" },
      { ...source, reference: "9999" },
      { ...source, model: "OTRO" },
      { ...source, title: "Otra máquina" },
      { ...source, url: `${source.url}?variante=distinta` },
      { ...source, condition: "Segunda mano" },
      { ...source, categoryKey: "otra-categoria" },
      { ...source, longDescription: `${source.longDescription ?? ""} Especificación cambiada.`, specs: { ...source.specs, ...recoverGamVerifiedResidualGeometrySpecs(source) } }
    ];
    const added = Object.keys(recoverGamVerifiedResidualGeometrySpecs(source)).find((key) => !Object.hasOwn(source.specs ?? {}, key));
    assert.ok(added, reference);
    for (const variant of altered) {
      if (variant.specs?.[added] !== undefined) {
        assert.deepEqual(recoverGamVerifiedResidualGeometrySpecs(variant), variant.specs ?? {}, `${reference}: evita sobrescribir`);
      } else {
        assert.deepEqual(recoverGamVerifiedResidualGeometrySpecs(variant), variant.specs ?? {}, `${reference}: identidad`);
      }
    }
  }
  const source = record("4623");
  const modified = { ...source, longDescription: (source.longDescription ?? "").replace("10 % sin carga", "20 % sin carga") };
  assert.deepEqual(recoverGamVerifiedResidualGeometrySpecs(modified), source.specs ?? {});
});

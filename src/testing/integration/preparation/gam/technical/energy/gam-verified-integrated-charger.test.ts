import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../../catalog/normalization/normalize-specs.js";
import { recoverGamVerifiedIntegratedCharger } from "../../../../../../preparation/gam/technical/energy/battery-electrical-evidence.js";
import { prepareSourceProduct } from "../../../../../../preparation/prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const references = ["2194", "2258", "2195", "2260", "2203", "3996", "3999", "4000", "2199", "2204", "2201", "2205", "2206"] as const;
const key = "Cargador de batería";

const getRecord = (reference: string): ProductRecord => {
  const found = catalog.products.find((record) => record.reference === reference);
  assert.ok(found, reference);
  return found;
};

test("acredita únicamente cargadores integrados de trece modelos identificados", () => {
  const changed: string[] = [];
  for (const record of catalog.products) {
    const snapshot = structuredClone(record);
    const recovered = recoverGamVerifiedIntegratedCharger(record);
    assert.deepEqual(record, snapshot, record.reference ?? "");
    for (const [name, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(recovered[name], value, `${record.reference}: ${name}`);
    }
    const additions = Object.keys(recovered).filter((name) => !Object.hasOwn(record.specs ?? {}, name));
    if (!additions.length) continue;
    assert.deepEqual(additions, [key], record.reference ?? "");
    assert.equal(recovered[key], "Integrado", record.reference ?? "");
    changed.push(record.reference ?? "");
  }
  assert.deepEqual(new Set(changed), new Set(references));
  assert.equal(changed.length, references.length);
});

test("mantiene el cargador en preparación y normalización", () => {
  for (const reference of references) {
    const prepared = prepareSourceProduct(getRecord(reference)).product;
    assert.equal(prepared.spec[key], "Integrado", reference);
    const normalized = normalizeSpecsObject(prepared.spec);
    assert.equal(normalized.normalized[key], "Integrado", reference);
    assert.ok(!normalized.unknownKeys.includes(key), reference);
  }
});

test("no acredita otros proveedores, identidades, variantes o textos sin evidencia", () => {
  for (const reference of references) {
    const record = getRecord(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: "0000" },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO" },
      { ...record, categoryKey: "otra" },
      { ...record, condition: "Segunda mano" },
      { ...record, url: `${record.url}?otra=1` },
      { ...record, title: "Otro modelo" },
      { ...record, shortDescription: "Otro modelo" },
      { ...record, longDescription: `${record.brand} ${record.model} sin referencia al equipamiento de carga` },
      { ...record, specs: { ...record.specs, [key]: "Cargador externo acreditado" } },
      { ...record, specs: { ...record.specs, [key.toLocaleLowerCase("es")]: "Cargador externo acreditado" } }
    ];
    for (const variant of variants) {
      assert.deepEqual(recoverGamVerifiedIntegratedCharger(variant), variant.specs ?? {}, reference);
    }
  }
});

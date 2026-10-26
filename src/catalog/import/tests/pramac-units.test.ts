import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = await readCanonicalCatalog("src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json");
const power = catalog.attributes.find((attribute) => attribute.name === "Potencia");
assert.ok(power);

const source = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

const recovered = [
  ["1210", 65], ["1212", 110], ["1213", 165], ["1216", 515],
  ["1217", 815], ["1218", 1270], ["1219", 3365]
] as const;

test("siete potencias nominales en kVA no se comparan con teasers sin unidad válida", () => {
  for (const [reference, nominal] of recovered) {
    const original = source(reference);
    const snapshot = JSON.stringify(original);
    const prepared = prepareProduct(original, catalog);
    assert.match(original.shortDescription ?? "", /\d[\d.,]*\s+kWA\b/);
    assert.deepEqual(resolveAttribute(original, power), { status: "resolved", value: nominal }, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.ok(prepared.product.attributes.some((attribute) => attribute.attributeID === power.id && attribute.value === nominal));
    assert.equal(prepared.product.description, original.shortDescription);
    assert.deepEqual(prepared.product.spec, original.specs);
    assert.equal(JSON.stringify(original), snapshot);
  }
});

test("exige la estructura comercial exacta, identidad, condición y ausencia de conflicto real", () => {
  const original = source("1213");
  const rejected: readonly ProductRecord[] = [
    { ...original, shortDescription: original.shortDescription?.replace("kWA", "kVA") ?? null },
    { ...original, shortDescription: original.shortDescription?.replace("194,51 kWA", "190 kVA") ?? null },
    { ...original, shortDescription: `${original.shortDescription ?? ""} Potencia 194,51 kWA` },
    { ...original, shortDescription: `${original.shortDescription ?? ""} Potencia continua 190 kVA` },
    { ...original, shortDescription: original.shortDescription?.replace("GSW165P", "GSW110V") ?? null },
    { ...original, shortDescription: original.shortDescription?.replace("nuevo", "usado") ?? null },
    { ...original, longDescription: `${original.longDescription ?? ""} Potencia grupo 190 kVA` },
    { ...original, specs: { ...original.specs, Potencia: "190 kVA" } },
    { ...original, model: "GSW110V" },
    { ...original, specs: { ...original.specs, Marca: "OTRA" } },
    { ...original, specs: { ...original.specs, Modelo: "GSW110V" } },
    { ...original, condition: "Segunda mano" },
    { ...original, providerId: "gomariz" },
    { ...original, url: original.url.replace("/pramac/", "/yale/") }
  ];
  for (const [index, item] of rejected.entries()) {
    assert.notDeepEqual(resolveAttribute(item, power), { status: "resolved", value: 165 }, String(index));
  }
});

test("los regímenes de emergencia y continuo legítimos permanecen diferenciados", () => {
  assert.deepEqual(resolveAttribute(source("1211"), power), { status: "resolved", value: 80 });
  assert.deepEqual(resolveAttribute(source("1214"), power), { status: "resolved", value: 200 });
  assert.deepEqual(resolveAttribute(source("6834"), power), { status: "resolved", value: 32 });
  assert.equal(prepareProduct(source("6834"), catalog).status, "ready");
});


import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamVerifiedElevationGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/verified-elevation-general.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const references = new Set([
  "4731", "4738", "4740", "4742", "4800", "4744", "4803", "4746", "4805", "4766",
  "4779", "4780", "4772", "4777", "4783", "4785", "4787", "4791", "4761", "2155"
]);

const byReference = (reference: string): ProductRecord => {
  const record = gam.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

test("condensa 20 generales de elevación con identidad y medidas de su propio anuncio", () => {
  let improved = 0;
  for (const record of gam.products) {
    const prepared = prepareSourceProduct(record);
    const summary = prepared.product.description_general;
    if (!record.reference || !references.has(record.reference)) {
      assert.equal(resolveGamVerifiedElevationGeneral(record, summary), null);
      continue;
    }
    const original = JSON.stringify(record);
    assert.ok(summary && record.longDescription && record.model && record.brand, record.reference);
    assert.ok(summary.length >= 350 && summary.length <= 750, record.reference);
    assert.ok(summary.length < record.longDescription.length * 0.7, record.reference);
    assert.ok(normalize(summary).includes(normalize(record.model)), record.reference);
    assert.ok(normalize(summary).includes(normalize(record.brand)), record.reference);
    assert.ok(summary.includes("capacidad nominal de cesta"), record.reference);
    assert.ok(summary.includes("límites de inclinación"), record.reference);
    assert.notEqual(summary, record.longDescription, record.reference);
    assert.equal(JSON.stringify(record), original, record.reference);
    assert.equal(prepared.product.description, record.shortDescription, record.reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(prepared.product.spec[key], value, `${record.reference}:${key}`);
    }
    improved++;
  }
  assert.equal(improved, 20);
  for (const record of gomariz.products) {
    assert.equal(resolveGamVerifiedElevationGeneral(record, record.longDescription), null);
  }
});

test("no aplica un texto de elevación cuando se altera la fuente, variante o preparación previa", () => {
  for (const reference of references) {
    const record = byReference(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: "OTRA" },
      { ...record, url: `${record.url}?updated=1` },
      { ...record, title: "Otra plataforma" },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO" },
      { ...record, externalReference: "OTRA" },
      { ...record, condition: "Segunda mano" },
      { ...record, categoryKey: "elevacion" },
      { ...record, shortDescription: "Descripción corta actualizada" },
      { ...record, longDescription: "Descripción general actualizada" },
      { ...record, specs: { ...record.specs, "Altura de elevación (m)": "Otro valor" } },
      { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "Otro valor" } },
      { ...record, specs: { ...record.specs, "Tipo de batería": "Otro tipo" } }
    ];
    for (const variant of variants) {
      assert.equal(resolveGamVerifiedElevationGeneral(variant, record.longDescription), null, reference);
    }
    assert.equal(resolveGamVerifiedElevationGeneral(record, "Otra preparación"), null, reference);
  }
});

test("separa el tipo de plataforma y la batería de cada variante documentada", () => {
  const scissor = prepareSourceProduct(byReference("4803")).product.description_general;
  const articulated = prepareSourceProduct(byReference("4779")).product.description_general;
  const telescopic = prepareSourceProduct(byReference("4785")).product.description_general;
  assert.match(scissor ?? "", /tijera el[eé]ctrica.*XG1523ERT-LI.*680 kg/s);
  assert.match(scissor ?? "", /bater[ií]a de litio/);
  assert.match(articulated ?? "", /articulada h[ií]brida.*XGA18H.*320 kg/s);
  assert.match(telescopic ?? "", /telesc[oó]pica di[eé]sel.*XGS22K.*300 kg/s);
  assert.doesNotMatch(articulated ?? "", /bater[ií]a de litio/);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { includeGamSourceBatteryVoltageInGeneral } from "../../../../mapping/providers/gam/editorial-descriptions/source-battery-voltage-general.js";
import { createGamCondensedEditorialResolver } from "../../../../mapping/providers/gam/editorial-descriptions/condensed-editorial-resolver.js";
import { platformsEvidence } from "../../../../evidence/providers/gam/editorial/condensed/platforms.js";

const { general: resolveGamPlatformCondensedGeneral, short: resolveGamPlatformCondensedShort } = createGamCondensedEditorialResolver(platformsEvidence, true);

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const references = new Set([
  "4733", "4804", "4799", "4788", "4795", "4798", "4808", "4809", "4810", "4806",
  "4801", "4762", "4782", "4756", "4759", "4754", "4757", "4749", "4748", "4793"
]);
const words = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;
const find = (reference: string): ProductRecord => {
  const record = gam.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("las descripciones de plataformas requieren la evidencia exacta de veinte fichas", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const general = resolveGamPlatformCondensedGeneral(record);
    const short = resolveGamPlatformCondensedShort(record);
    if (general === null) {
      assert.equal(short, null, record.reference ?? "");
      continue;
    }
    assert.ok(record.reference && record.model && record.longDescription && short);
    changed.add(record.reference);
    assert.ok(general.toLowerCase().includes(record.model.toLowerCase()), record.reference);
    assert.ok(words(general) >= 90 && words(general) < words(record.longDescription) * 0.64, record.reference);
    assert.ok(words(short) <= 25, record.reference);
    const prepared = prepareSourceProduct(record).product;
    assert.equal(prepared.description_general,
      includeGamSourceBatteryVoltageInGeneral(record, general, prepared.spec), record.reference);
    assert.equal(prepared.description, short, record.reference);
    assert.equal(prepared.reference, record.reference);
    assert.equal(prepared.sourceUrl, record.url);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.equal(prepared.spec[key], value, `${record.reference}:${key}`);
    }
  }
  assert.deepEqual(changed, references);
  for (const record of gomariz.products) {
    assert.equal(resolveGamPlatformCondensedGeneral(record), null);
    assert.equal(resolveGamPlatformCondensedShort(record), null);
  }
});

test("las ediciones no sobreviven a alteraciones de referencia, fuente, identidad ni especificaciones", () => {
  const record = find("4798");
  assert.ok(resolveGamPlatformCondensedGeneral(record));
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, reference: "4795" },
    { ...record, model: "XGS28ACK" },
    { ...record, externalReference: "XGS28ACK" },
    { ...record, title: "Plataforma de otra gama" },
    { ...record, url: `${record.url}?variante=1` },
    { ...record, brand: "OTRA" },
    { ...record, categoryKey: "elevacion-usada" },
    { ...record, shortDescription: "Resumen modificado" },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "300 KG" } },
    { ...record, longDescription: `${record.longDescription ?? ""} Texto nuevo no contrastado.` }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveGamPlatformCondensedGeneral(variant), null, String(index));
    assert.equal(resolveGamPlatformCondensedShort(variant), null, String(index));
  }
});

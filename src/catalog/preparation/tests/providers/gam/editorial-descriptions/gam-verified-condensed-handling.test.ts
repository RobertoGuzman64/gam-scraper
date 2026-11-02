import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamHandlingCondensedGeneral, resolveGamHandlingCondensedShort } from "../../../../mapping/providers/gam/editorial-descriptions/verified-condensed-handling.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const references = new Set([
  "2194", "2195", "2196", "2197", "2198", "2199", "2200", "2201", "2203", "2204", "2205", "2258",
  "2102", "2103", "2261", "2262", "2332", "2295", "2224", "2225"
]);
const words = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;
const find = (reference: string): ProductRecord => {
  const record = gam.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("las reescrituras de manutención se aplican únicamente a veinte fichas acreditadas", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const general = resolveGamHandlingCondensedGeneral(record);
    const short = resolveGamHandlingCondensedShort(record);
    if (general === null) {
      assert.equal(short, null, record.reference ?? "");
      continue;
    }
    assert.ok(record.reference && record.model && short);
    changed.add(record.reference);
    assert.ok(general.toLowerCase().includes(record.model.toLowerCase()), record.reference);
    assert.ok(words(general) >= 74 && words(general) < words(record.longDescription ?? "") * 0.6, record.reference);
    assert.ok(words(short) <= 28, record.reference);
    const prepared = prepareSourceProduct(record).product;
    assert.equal(prepared.description_general, general, record.reference);
    assert.equal(prepared.description, short, record.reference);
    assert.equal(prepared.reference, record.reference);
    assert.equal(prepared.sourceUrl, record.url);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.equal(prepared.spec[key], value, `${record.reference}:${key}`);
    }
  }
  assert.deepEqual(changed, references);
  for (const record of gomariz.products) {
    assert.equal(resolveGamHandlingCondensedGeneral(record), null);
    assert.equal(resolveGamHandlingCondensedShort(record), null);
  }
});

test("rechaza fichas con modificaciones de evidencia o identidad, sin aceptar variantes", () => {
  const record = find("2262");
  assert.ok(resolveGamHandlingCondensedGeneral(record));
  const cases: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, reference: "2261" },
    { ...record, model: "MT70" },
    { ...record, externalReference: "MT70" },
    { ...record, title: "Tractor diferente" },
    { ...record, url: `${record.url}?variante=1` },
    { ...record, brand: "HYSTER" },
    { ...record, categoryKey: "carretillas-usadas" },
    { ...record, shortDescription: "Resumen modificado" },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "8000 KG" } },
    { ...record, longDescription: `${record.longDescription ?? ""} Cambio sin verificar.` }
  ];
  for (const [index, candidate] of cases.entries()) {
    assert.equal(resolveGamHandlingCondensedGeneral(candidate), null, String(index));
    assert.equal(resolveGamHandlingCondensedShort(candidate), null, String(index));
  }
});

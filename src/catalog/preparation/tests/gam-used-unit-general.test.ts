import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamUsedUnitGeneral } from "../mapping/providers/gam/used-unit-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const expected = new Set([
  "6937", "6967", "6682", "6683", "6703", "6694", "6695", "6696",
  "6677", "6678", "6884", "6697", "6803", "5950", "5952", "5953"
]);

const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM: 16 unidades de segunda mano con descripciones compartidas se identifican por origen", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const original = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    const general = prepared.product.description_general;
    const prefix = /^Referencia GAM (\d+)\. Ubicación indicada en la ficha de origen: ([A-ZÁÉÍÓÚÜÑ\s-]+)\.\n\n/u.exec(general ?? "");
    if (prefix) {
      assert.ok(record.reference && general && record.location);
      assert.equal(prefix[1], record.reference);
      assert.equal(prefix[2], record.location);
      assert.equal(record.specs?.Ubicación, record.location);
      assert.ok(expected.has(record.reference), record.reference);
      assert.equal(resolveGamUsedUnitGeneral(record, general.slice(prefix[0].length)), general);
      assert.equal(record.condition, "Segunda mano");
      changed.add(record.reference);
    }
    assert.deepEqual(record, original);
  }
  assert.deepEqual(changed, expected);
});

test("GAM: la identificación se anula al cambiar unidad, procedencia o fuente", () => {
  const record = find("6937");
  const general = prepareSourceProduct(record).product.description_general;
  assert.ok(general);
  const prior = general.replace(/^Referencia GAM 6937\. Ubicación indicada en la ficha de origen: GIRONA\.\n\n/u, "");
  assert.notEqual(prior, general);
  const invalid: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Nuevo" },
    { ...record, reference: "6967" },
    { ...record, location: "TOLEDO" },
    { ...record, model: "OPTIMUM 10" },
    { ...record, brand: "GENIE" },
    { ...record, title: "Plataforma GENIE OPTIMUM 8" },
    { ...record, specs: { ...record.specs, Ubicación: "TOLEDO" } },
    { ...record, specs: { ...record.specs, Modelo: "OPTIMUM 10" } },
    { ...record, longDescription: `${record.longDescription ?? ""} Fabricada en 2018.` },
    { ...record, url: record.url.replace("6937-", "6967-") },
    { ...record, url: record.url.replace("online.gamrentals.com", "example.com") },
    { ...record, url: `${record.url}?variation=1` }
  ];
  for (const [index, variant] of invalid.entries()) {
    assert.equal(resolveGamUsedUnitGeneral(variant, prior), null, String(index));
  }
  assert.equal(resolveGamUsedUnitGeneral(record, general), null);
  assert.equal(resolveGamUsedUnitGeneral(find("6051"), prior), null);
  assert.equal(resolveGamUsedUnitGeneral(find("6930"), prior), null);
  assert.equal(resolveGamUsedUnitGeneral(find("6883"), prior), null);
});

test("GAM: no se atribuyen ubicaciones a otro proveedor ni a una referencia distinta", () => {
  for (const record of gomariz.products) {
    assert.equal(resolveGamUsedUnitGeneral(record, prepareSourceProduct(record).product.description_general), null);
  }
  const first = prepareSourceProduct(find("6694")).product.description_general;
  const second = prepareSourceProduct(find("6677")).product.description_general;
  assert.ok(first?.includes("VIGO") && second?.includes("MURCIA"));
  assert.notEqual(first, second);
  assert.equal(resolveGamUsedUnitGeneral(find("6677"), first), null);
});

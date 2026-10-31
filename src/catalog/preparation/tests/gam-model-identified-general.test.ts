import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamModelIdentifiedGeneral } from "../mapping/providers/gam/model-identified-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const improved = new Set(["4765", "6185", "6188", "217", "215", "216", "211", "212", "213", "4031", "234", "239", "237", "243", "235"]);

const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((entry) => entry.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Fase 19: identifica 15 modelos acreditados sin modificar los originales", () => {
  const changed = new Set<string>();
  for (const record of catalog.products) {
    const previous = JSON.stringify(record);
    const prepared = prepareSourceProduct(record).product;
    const result = resolveGamModelIdentifiedGeneral(record, prepared.description_general?.replace(
      /^Modelo identificado en la ficha: [^\n]+\n\n/u, "") ?? null);
    if (result !== null) {
      assert.ok(record.reference);
      changed.add(record.reference);
      assert.equal(prepared.description_general, result);
      assert.ok(result.includes(`${record.brand} ${record.model}`));
      assert.ok(result.endsWith(record.longDescription?.trim() ?? ""));
      assert.equal(prepared.reference, record.reference);
      assert.equal(prepared.sourceUrl, record.url);
    }
    assert.equal(JSON.stringify(record), previous);
  }
  assert.deepEqual(changed, improved);
});

test("Fase 19: rechaza identidad, origen y contenido discordantes", () => {
  const record = find("217");
  const general = record.longDescription?.trim() ?? "";
  assert.ok(resolveGamModelIdentifiedGeneral(record, general));
  const invalid: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "215" },
    { ...record, model: "RR S" },
    { ...record, title: "Volteador Logitrans RR S" },
    { ...record, shortDescription: "Volteador Logitrans RR S" },
    { ...record, brand: "OTRA" },
    { ...record, categoryKey: "maquinaria" },
    { ...record, condition: "Segunda mano" },
    { ...record, specs: { ...record.specs, Modelo: "RR S" } },
    { ...record, specs: { ...record.specs, Marca: "OTRA" } },
    { ...record, longDescription: "Descripción genérica distinta." },
    { ...record, url: "https://example.com/217-volteador-de-bidones-350-kg-logitrans-mdt" },
    { ...record, url: record.url.replace("217-", "215-") },
    { ...record, url: "not-a-url" }
  ];
  for (const [index, candidate] of invalid.entries()) {
    assert.equal(resolveGamModelIdentifiedGeneral(candidate, general), null, String(index));
  }
  assert.equal(resolveGamModelIdentifiedGeneral(record, `Modelo identificado en la ficha: LOGITRANS MDT.\n\n${general}`), null);
});

test("Fase 19: mantiene fuera referencias ambiguas y casos con variantes incompatibles", () => {
  for (const reference of ["5949", "6806", "2028", "1218", "2148", "6634"]) {
    const record = find(reference);
    assert.equal(resolveGamModelIdentifiedGeneral(record, record.longDescription), null, reference);
  }
});

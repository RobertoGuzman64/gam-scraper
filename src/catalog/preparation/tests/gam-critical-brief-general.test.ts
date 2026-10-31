import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamCriticalBriefGeneral } from "../mapping/providers/gam/critical-brief-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};
const count = (value: string): number => value.split(/\s+/u).filter(Boolean).length;
const references = ["5710", "6358", "6367", "920", "2263", "2111", "6617"] as const;

test("GAM: conserva las seis generales de F10 y recupera la 6617", () => {
  const modified: string[] = [];
  for (const record of catalog.products) {
    const baseline = JSON.stringify(record);
    const editorial = resolveGamCriticalBriefGeneral(record);
    if (editorial) {
      assert.ok(record.reference);
      modified.push(record.reference);
      assert.ok(record.reference === "6617" ? count(record.longDescription ?? "") === 22 : count(record.longDescription ?? "") < 20, record.reference);
      assert.ok(count(editorial) >= 60, record.reference);
      const prepared = prepareSourceProduct(record);
      assert.equal(prepared.product.description_general, editorial);
      assert.equal(prepared.product.reference, record.reference);
      assert.equal(prepared.product.sourceUrl, record.url);
      assert.deepEqual(prepared.product.spec, record.specs);
    }
    assert.equal(JSON.stringify(record), baseline);
  }
  assert.deepEqual(new Set(modified), new Set(references));
  assert.equal(catalog.products.length, 983);
});

test("GAM F10: conserva los datos técnicos y diferencia unidades de un mismo modelo", () => {
  const outputs = new Map(references.map((ref) => [ref, resolveGamCriticalBriefGeneral(find(ref))]));
  assert.ok(outputs.get("5710")?.includes("21.400 kg"));
  assert.ok(outputs.get("5710")?.includes("mayo de 2026"));
  assert.ok(outputs.get("6358")?.includes("CPH200003"));
  assert.ok(outputs.get("6367")?.includes("CPH200004"));
  assert.notEqual(outputs.get("6358"), outputs.get("6367"));
  assert.ok(outputs.get("920")?.includes("1.500 kg"));
  assert.ok(outputs.get("2263")?.includes("560 a 700 Ah"));
  assert.ok(outputs.get("2111")?.includes("10.880 mm"));
  assert.ok(!outputs.get("2263")?.includes("6085 metros"));
  assert.ok(!outputs.get("920")?.includes("2.420 mm"));
  assert.ok(outputs.get("6617")?.includes("6.043 horas"));
  assert.ok(outputs.get("6617")?.includes("la ficha técnica difieren"));
});

test("GAM F10: no propaga contenido a unidades o fichas alteradas", () => {
  for (const reference of references) {
    const record = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: `${reference}x` },
      { ...record, url: `${record.url}?tracked=1` },
      { ...record, model: "OTRO" },
      { ...record, longDescription: "Descripción alternativa de la unidad" },
      { ...record, specs: { ...record.specs, "Modelo": "OTRO" } }
    ];
    for (const [index, variant] of variants.entries()) {
      assert.equal(resolveGamCriticalBriefGeneral(variant), null, `${reference}:${index}`);
    }
  }
  for (const reference of ["5991", "5992", "2305", "2628", "2150", "6217"]) {
    assert.equal(resolveGamCriticalBriefGeneral(find(reference)), null, reference);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamPriorityBriefGeneral } from "../mapping/providers/gam/priority-brief-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((value) => value.reference === reference);
  assert.ok(record, reference);
  return record;
};
const words = (value: string): number => value.split(/\s+/u).filter(Boolean).length;

test("GAM: las generales editoriales atacan tres insuficiencias prioritarias y no otras fichas", () => {
  const changed: string[] = [];
  for (const record of catalog.products) {
    const before = JSON.stringify(record);
    const result = resolveGamPriorityBriefGeneral(record);
    if (result !== null) {
      assert.ok(record.reference);
      changed.push(record.reference);
      assert.ok(words(record.longDescription ?? "") < 20, record.reference);
      assert.ok(words(result) >= 60, record.reference);
      const prepared = prepareSourceProduct(record);
      assert.equal(prepared.product.description_general, result, record.reference);
      assert.equal(prepared.product.description, record.shortDescription?.trim() ?? null, record.reference);
      assert.deepEqual(prepared.product.spec, record.specs);
      assert.equal(prepared.product.reference, record.reference);
      assert.equal(prepared.product.sourceUrl, record.url);
    }
    assert.equal(JSON.stringify(record), before);
  }
  assert.deepEqual(new Set(changed), new Set(["2628", "6217", "2150"]));
  assert.equal(catalog.products.length, 983);
});

test("GAM: Orion 55 CP recupera equipamiento contrastado sin trasladar la longitud malformada", () => {
  const record = find("2628");
  const result = resolveGamPriorityBriefGeneral(record);
  assert.ok(result);
  for (const fragment of ["Orion 55 CP", "5,5 metros", "400 kg", "1.840 kg", "360°", "estabilizadores", "emergencia"]) {
    assert.ok(result.includes(fragment), fragment);
  }
  assert.ok(!result.includes("2'7'"));
  const altered: readonly ProductRecord[] = [
    { ...record, reference: "2627" },
    { ...record, model: "Orion 55" },
    { ...record, url: record.url.replace("2628-", "2627-") },
    { ...record, providerId: "gomariz" },
    { ...record, longDescription: "Descripción disponible y completa." },
    { ...record, shortDescription: "Portaféretros con altura de 6 metros." },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "500 KG" } },
    { ...record, specs: { ...record.specs, "Altura de trabajo (m)": "6 metros" } }
  ];
  for (const [index, variant] of altered.entries()) {
    assert.equal(resolveGamPriorityBriefGeneral(variant), null, String(index));
  }
});

test("GAM: ficha del vehículo no perpetúa una ITV con fecha y bloquea otra unidad", () => {
  const record = find("6217");
  const result = resolveGamPriorityBriefGeneral(record);
  assert.ok(result);
  for (const fragment of ["Rover Sport", "194.101 km", "4.880 mm", "1.980 mm", "2018"]) {
    assert.ok(result.includes(fragment), fragment);
  }
  assert.ok(!result.includes("ITV vigente"));
  for (const changed of [
    { ...record, reference: "6218" },
    { ...record, externalReference: "1111-AAA" },
    { ...record, specs: { ...record.specs, Kilómetros: "294101 KM" } },
    { ...record, url: `${record.url}?source=other` }
  ]) assert.equal(resolveGamPriorityBriefGeneral(changed), null);
});

test("GAM: manipulador respeta modelo, capacidad, motorización y transmisión", () => {
  const record = find("2150");
  const result = resolveGamPriorityBriefGeneral(record);
  assert.ok(result);
  for (const fragment of ["H8XD-EC7", "8.000 kg", "18,768 metros", "MTU", "ZF 5WG211", "36.862 kg"]) {
    assert.ok(result.includes(fragment), fragment);
  }
  for (const changed of [
    { ...record, model: "H8XD-EC8" },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "7000 KG" } },
    { ...record, specs: { ...record.specs, "Tipo motor": "Eléctrico" } },
    { ...record, longDescription: "Manipulador de contenedores de otro modelo" }
  ]) assert.equal(resolveGamPriorityBriefGeneral(changed), null);
});

test("GAM: no interviene los extremos Yale bloqueados ni Gomariz", async () => {
  for (const reference of ["5991", "5992", "5710", "2305", "6358", "6367"]) {
    assert.equal(resolveGamPriorityBriefGeneral(find(reference)), null, reference);
  }
  const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
  for (const record of gomariz.products) assert.equal(resolveGamPriorityBriefGeneral(record), null);
});

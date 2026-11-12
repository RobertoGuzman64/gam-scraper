import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";

const [gam, gomariz, mercaeleva] = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);

const get = (records: readonly ProductRecord[], reference: string): ProductRecord => {
  const record = records.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("plataformas telescópicas de dos fuentes reales reutilizan familia, magnitudes y composición", () => {
  const first = get(gomariz.products, "BT1102");
  const second = get(mercaeleva.products, "M749-9513");
  const third = get(gomariz.products, "BT1461");
  const original = JSON.stringify([first, second, third]);
  const firstFacts = resolveEditorialFacts(first);
  const secondFacts = resolveEditorialFacts(second);
  assert.equal(firstFacts?.family, "plataforma-telescopica");
  assert.equal(secondFacts?.family, "plataforma-telescopica");
  assert.equal(firstFacts?.workingHeightM, 43.15);
  assert.equal(firstFacts.lateralReachM, 24.38);
  assert.equal(firstFacts.loadCapacityKg, 454);
  assert.equal(resolveEditorialFacts(third)?.family, "plataforma-telescopica");
  assert.equal(secondFacts?.workingHeightM, 16);
  assert.equal(secondFacts.lateralReachM, null);
  assert.equal(secondFacts.loadCapacityKg, null);
  const firstText = resolveReusableEditorial(first);
  const secondText = resolveReusableEditorial(second);
  assert.match(firstText.short ?? "", /altura de trabajo de 43,15 m, alcance lateral de 24,38 m y capacidad de 454 kg/u);
  assert.match(secondText.short ?? "", /altura de trabajo de 16 m/u);
  assert.doesNotMatch(secondText.short ?? "", /alcance lateral|capacidad de/u);
  assert.match(firstText.general ?? "", /plataforma telescópica/u);
  assert.match(secondText.general ?? "", /plataforma telescópica/u);
  assert.equal(prepareSourceProduct(first).product.description, firstText.short);
  assert.match(prepareSourceProduct(second).product.description_general ?? "", /^La plataforma telescópica/u);
  assert.match(resolveReusableEditorial(third).short ?? "", /altura de trabajo de 15,6 m/u);
  assert.equal(JSON.stringify([first, second, third]), original);
});

test("los títulos y las generales de origen conservan identidad y precedencia", () => {
  const gom = get(gomariz.products, "BT1102");
  const merca = get(mercaeleva.products, "M749-9513");
  const gamRecord = get(gam.products, "4782");
  for (const record of [gom, merca, gamRecord]) {
    const result = prepareSourceProduct(record);
    assert.equal(result.status, "ready", record.reference ?? undefined);
    assert.ok(record.brand, record.reference ?? undefined);
    assert.ok(record.model, record.reference ?? undefined);
    const normalized = (value: string): string => value.normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");
    assert.ok(normalized(result.product.title ?? "").includes(normalized(record.brand)));
    assert.ok(normalized(result.product.title ?? "").includes(normalized(record.model)));
    assert.ok(result.product.description_general?.trim(), record.reference ?? undefined);
  }
  assert.notEqual(prepareSourceProduct(merca).product.description, resolveReusableEditorial(merca).short);
  assert.equal(resolveEditorialFacts(gamRecord), null);
});

test("telescópicas: no confundir manipuladores, alturas de elevación ni proveedores", () => {
  const telescopic = get(gomariz.products, "BT1102");
  const merca = get(mercaeleva.products, "M749-9513");
  const other = get(gomariz.products, "BT1139");
  assert.equal(resolveEditorialFacts(get(gomariz.products, "MT1661")), null);
  assert.equal(resolveEditorialFacts(get(mercaeleva.products, "M005-5167")), null);
  assert.equal(resolveEditorialFacts(get(gam.products, "4782")), null);
  assert.match(resolveReusableEditorial(other).short ?? "", /altura de trabajo de 20,39 m/u);
  assert.doesNotMatch(resolveReusableEditorial(other).short ?? "", /43,15 m/u);
  const invalid: readonly ProductRecord[] = [
    { ...telescopic, providerId: "mercaeleva" },
    { ...telescopic, model: "OTRO MODELO" },
    { ...telescopic, condition: "Nuevo" },
    { ...telescopic, url: telescopic.url.replace("gomarizrent.com", "otra-fuente.com") },
    { ...telescopic, specs: { ...telescopic.specs, "Altura de trabajo": "43 kg" } },
    { ...telescopic, specs: { ...telescopic.specs, "Alcance lateral": "24 kg" } },
    { ...telescopic, specs: { ...telescopic.specs, Capacidad: "454 litros" } },
    { ...telescopic, specs: { ...telescopic.specs, Motor: "Eléctrico" } },
    { ...merca, specs: { ...merca.specs, "Altura de trabajo": "18 m" } },
    { ...merca, specs: { ...merca.specs, "Título adicional": "PLATAFORMA TELESCOPICA DIESEL 18 MT" } },
    { ...merca, specs: { ...merca.specs, "Tipo de motor": "Eléctrico" } },
    { ...merca, url: merca.url.replace("sales.mercaeleva.com", "otra-fuente.com") }
  ];
  for (const [index, record] of invalid.entries()) {
    assert.equal(resolveEditorialFacts(record), null, `rechazo ${index}`);
    assert.deepEqual(resolveReusableEditorial(record), { short: null, general: null }, `texto ${index}`);
  }
});

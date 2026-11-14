import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";

const tijera: ProductRecord = {
  providerId: "gomariz",
  categoryKey: "venta",
  categoryName: "Maquinaria de ocasión",
  url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-s1413eii-tijera-electrica-scissor-lift/",
  title: "LGMG S1413EII",
  shortDescription: null,
  longDescription: "Las Tijeras Eléctricas están diseñadas para trabajar en interior, alcanzan una altura desde los 5m a los 26,5m. Se caracterizan por llevas ruedas anti-huellas y plataforma extensible, lo que permite ampliar la zona de trabajo.",
  price: null,
  condition: "Segunda mano",
  reference: "TE1620",
  brand: "LGMG",
  model: "S1413EII",
  year: "2024",
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  image: null,
  specs: {
    "Altura plataforma": "13.8 m",
    "Altura de trabajo": "15.8 m",
    "Altura almacenaje": "2.74 m",
    Longitud: "2.80 m",
    Anchura: "1.30 m",
    Peso: "3500 kg",
    Motor: "Eléctrico",
    Capacidad: "320 kg"
  }
};

const articulada: ProductRecord = {
  providerId: "gomariz",
  categoryKey: "venta",
  categoryName: "Maquinaria de ocasión",
  url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/skyjack-sj85aj-brazos-articulados-articulated-boom-lift/",
  title: "SKYJACK SJ85AJ",
  shortDescription: null,
  longDescription: "Las Articuladas Diésel son muy útil para trabajos en exterior ya que son capaces de moverse en casi cualquier terreno y superar pendientes con un desnivel notable. Capaces de alcanzar alturas de 12m a 43m.",
  price: null,
  condition: "Segunda mano",
  reference: "BA1335",
  brand: "Skyjack",
  model: "SJ85AJ",
  year: "2018",
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  image: null,
  specs: {
    "Altura plataforma": "25.91 m",
    "Altura de trabajo": "27.74 m",
    "Alcance lateral": "17.07 m",
    "Altura almacenaje": "2.67 m",
    Longitud: "11.63 m",
    Anchura: "2.49 m",
    Peso: "16465 kg",
    Motor: "Diésel",
    Capacidad: "227 kg"
  }
};

const historical = [
  { source: tijera, family: "plataforma-tijera", platform: 13.8, stored: 2.74, work: 15.8 },
  { source: articulada, family: "plataforma-articulada", platform: 25.91, stored: 2.67, work: 27.74 }
] as const;

const anotherUnit = (source: ProductRecord, platform: string, stored: string): ProductRecord => ({
  ...source,
  reference: `${source.reference}-OTRA`,
  url: `${source.url.replace(/\/$/u, "")}-otra-unidad/`,
  year: null,
  specs: { ...source.specs, "Altura plataforma": platform, "Altura almacenaje": stored }
});

test("alturas históricas de plataforma y almacenaje se consumen sin confundir la de trabajo", () => {
  for (const { source, family, platform, stored, work } of historical) {
    const original = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, family);
    assert.equal(facts?.workingHeightM, work);
    assert.equal(facts?.platformHeightM, platform);
    assert.equal(facts?.storedHeightM, stored);
    const composed = resolveReusableEditorial(source);
    const prepared = prepareSourceProduct(source);
    assert.match(composed.short ?? "", /altura de plataforma de /u);
    assert.match(composed.general ?? "", /altura de almacenaje de /u);
    assert.equal(prepared.status, "ready");
    assert.ok((prepared.product.description ?? "").includes("altura de plataforma de "));
    assert.ok((prepared.product.description_general ?? "").includes("altura de almacenaje de "));
    assert.equal(JSON.stringify(source), original);
  }
});

test("una unidad nueva conserva únicamente sus alturas técnicas propias", () => {
  for (const { source, platform, stored, forbiddenPlatform, forbiddenStored } of [
    { source: tijera, platform: "12.5 m", stored: "2.51 m", forbiddenPlatform: "13,8 m", forbiddenStored: "2,74 m" },
    { source: articulada, platform: "24 m", stored: "2.45 m", forbiddenPlatform: "25,91 m", forbiddenStored: "2,67 m" }
  ] as const) {
    const newRecord = anotherUnit(source, platform, stored);
    const snapshot = JSON.stringify([source, newRecord]);
    const facts = resolveEditorialFacts(newRecord);
    assert.equal(facts?.family, resolveEditorialFacts(source)?.family);
    assert.equal(facts?.platformHeightM, Number(platform.split(" ")[0]));
    assert.equal(facts?.storedHeightM, Number(stored.split(" ")[0]));
    const general = prepareSourceProduct(newRecord);
    assert.equal(general.status, "ready");
    assert.equal(general.product.reference, newRecord.reference);
    assert.equal(general.product.sourceUrl, newRecord.url);
    assert.ok((general.product.description_general ?? "").includes(`altura de plataforma de ${platform.replace(".", ",")}`));
    assert.ok((general.product.description_general ?? "").includes(`altura de almacenaje de ${stored.replace(".", ",")}`));
    assert.ok(!(general.product.description_general ?? "").includes(`altura de plataforma de ${forbiddenPlatform}`));
    assert.ok(!(general.product.description_general ?? "").includes(`altura de almacenaje de ${forbiddenStored}`));
    assert.equal(JSON.stringify([source, newRecord]), snapshot);
  }
});

test("procedencia, identidad y contradicciones bloquean la atribución de alturas", () => {
  for (const source of [tijera, articulada]) {
    for (const invalid of [
      { ...source, providerId: "gam" },
      { ...source, url: "https://example.invalid/venta/plataforma/" },
      { ...source, brand: "OTRA" },
      { ...source, model: "MODELO-DISTINTO" },
      { ...source, condition: "Nuevo" as const },
      { ...source, specs: { ...source.specs, "Altura plataforma": source.specs?.["Altura de trabajo"] ?? "" } },
      { ...source, specs: { ...source.specs, "Altura almacenaje": "30 m" } }
    ]) {
      assert.equal(resolveEditorialFacts(invalid), null, `${source.reference}: ${invalid.url}`);
      assert.deepEqual(resolveReusableEditorial(invalid), { short: null, general: null });
    }
  }
});

test("ausencia, unidades incompatibles y valores ambiguos no se convierten en la otra altura", () => {
  for (const [key, value, property, pattern] of [
    ["Altura plataforma", "13.8 kg", "platformHeightM", /altura de plataforma de /u],
    ["Altura plataforma", "13.8 m o 14 m", "platformHeightM", /altura de plataforma de /u],
    ["Altura almacenaje", "2740 kg", "storedHeightM", /altura de almacenaje de /u],
    ["Altura almacenaje", "2.74 m o 2.50 m", "storedHeightM", /altura de almacenaje de /u]
  ] as const) {
    const incompatible = { ...tijera, specs: { ...tijera.specs, [key]: value } };
    assert.equal(resolveEditorialFacts(incompatible)?.[property], null);
    assert.doesNotMatch(resolveReusableEditorial(incompatible).general ?? "", pattern);
  }
  const onlyWorking = { ...tijera, specs: { "Altura de trabajo": "15.8 m", Motor: "Eléctrico", Capacidad: "320 kg" } };
  assert.equal(resolveEditorialFacts(onlyWorking)?.platformHeightM, null);
  assert.equal(resolveEditorialFacts(onlyWorking)?.storedHeightM, null);
  assert.doesNotMatch(resolveReusableEditorial(onlyWorking).general ?? "", /altura (?:de plataforma|de almacenaje) de /u);
});

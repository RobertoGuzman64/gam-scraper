import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { normalizeCorroboratedEditorialFuel } from "../domain/editorial-fuel-coherence.js";
import { normalizePreparedEditorialPresentation } from "../mapping/prepared-editorial-presentation.js";
import { controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift } from "./editorial-contract-records.js";

const fuelSource = (base: ProductRecord, claimed: "diésel" | "GLP", declared: "diésel" | "GLP"): ProductRecord => ({
  ...base,
  title: `Carretilla elevadora ${claimed} MARCA MODELO10`,
  shortDescription: `Carretilla elevadora ${declared} MARCA MODELO10 para manutención.`,
  longDescription: `La carretilla elevadora ${declared} MARCA MODELO10 se equipa con motor ${declared} en esta configuración.`,
  specs: {
    ...base.specs,
    Marca: "MARCA",
    Modelo: "MODELO10",
    "Tipo motor": declared,
    "Motorización": declared
  }
});

const candidate = (record: ProductRecord) => ({
  ...prepareSourceProduct(record).product,
  title: record.title,
  description_title: record.title,
  description: record.shortDescription,
  description_general: record.longDescription
});

test("la motorización verificada en fuente y ficha corrige un título contradictorio en los tres proveedores", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source = fuelSource(base, "GLP", "diésel");
    const initial = JSON.stringify(source);
    const before = candidate(source);
    const updated = normalizeCorroboratedEditorialFuel(source, before);
    assert.equal(updated.title, "Carretilla elevadora diésel MARCA MODELO10", source.providerId);
    assert.equal(updated.description, before.description, source.providerId);
    const presented = normalizePreparedEditorialPresentation(source, before);
    assert.equal(presented.title, updated.title, source.providerId);
    assert.equal(presented.description_title, updated.title, source.providerId);
    assert.deepEqual(presented.spec, before.spec);
    assert.deepEqual(presented.attributes, before.attributes);
    assert.equal(JSON.stringify(source), initial);
  }
});

test("la motorización verificada corrige el resumen sin reescribir la general", () => {
  const source = fuelSource(controlledGamForklift(), "GLP", "GLP");
  const mismatched = { ...source, shortDescription: "Carretilla elevadora diésel MARCA MODELO10 para manutención." };
  const before = candidate(mismatched);
  const updated = normalizeCorroboratedEditorialFuel(mismatched, before);
  assert.equal(updated.title, before.title);
  assert.equal(updated.description, "Carretilla elevadora GLP MARCA MODELO10 para manutención.");
  assert.equal(normalizePreparedEditorialPresentation(mismatched, before).description, updated.description);
});

test("la energía eléctrica respeta el género de la familia técnica", () => {
  const forklift = fuelSource(controlledGamForklift(), "diésel", "diésel");
  const electricForklift: ProductRecord = {
    ...forklift,
    shortDescription: forklift.shortDescription?.replaceAll("diésel", "eléctrica") ?? null,
    longDescription: "La carretilla elevadora eléctrica MARCA MODELO10 tiene motor eléctrico.",
    specs: { ...forklift.specs, "Tipo motor": "Eléctrico", "Motorización": "Eléctrico" }
  };
  const electricTractor: ProductRecord = {
    ...electricForklift,
    title: "Tractor de arrastre diésel MARCA MODELO10",
    shortDescription: "Tractor de arrastre eléctrico MARCA MODELO10.",
    longDescription: "El tractor de arrastre eléctrico MARCA MODELO10 lleva motor eléctrico."
  };
  assert.equal(normalizeCorroboratedEditorialFuel(electricForklift, candidate(electricForklift)).title,
    "Carretilla elevadora eléctrica MARCA MODELO10");
  assert.equal(normalizeCorroboratedEditorialFuel(electricTractor, candidate(electricTractor)).title,
    "Tractor de arrastre eléctrico MARCA MODELO10");
});

test("ni una variante, ni una procedencia distinta, ni versiones ambiguas autorizan correcciones", () => {
  const original = fuelSource(controlledGamForklift(), "GLP", "diésel");
  const document = candidate(original);
  for (const changed of [
    { ...original, reference: "OTRA-UNIDAD" },
    { ...original, url: original.url + "?otra=1" },
    { ...original, providerId: "gomariz" },
    { ...original, model: "OTRA-VARIANTE" },
    { ...original, specs: { ...original.specs, "Motorización": "GLP" } },
    { ...original, specs: { ...original.specs, "Tipo motor": "Diésel / GLP" } },
    { ...original, longDescription: `${original.longDescription} Disponible también en versión GLP.` },
    { ...original, longDescription: "La carretilla MARCA MODELO10 está disponible en versiones GLP y diésel." },
    { ...original, longDescription: "La carretilla elevadora MARCA OTRA se equipa con motor diésel." }
  ]) assert.deepEqual(normalizeCorroboratedEditorialFuel(changed, document), {
    title: document.title, description: document.description
  });
  const alreadyFixed = normalizePreparedEditorialPresentation(original, document);
  assert.deepEqual(normalizePreparedEditorialPresentation(original, alreadyFixed), alreadyFixed);
});

test("la elevación procede de mm técnicos y no de una altura comercial incompatible", () => {
  const source: ProductRecord = {
    ...controlledGamForklift(),
    shortDescription: "Carretilla elevadora MARCA MODELO10, altura de 4,5 metros.",
    longDescription: "La carretilla elevadora MARCA MODELO10 anuncia altura de elevación de 6 metros.",
    specs: { Marca: "MARCA", Modelo: "MODELO10", "Altura de elevación (mm)": "4500 mm", "Capacidad de carga (kg)": "2500 kg" }
  };
  const facts = resolveEditorialFacts(source);
  assert.equal(facts?.liftingHeightM, 4.5);
  assert.match(resolveReusableEditorial(source).general ?? "", /altura de elevación de 4,5 m/u);
  assert.equal(resolveEditorialFacts({ ...source, specs: { ...source.specs, "Altura de elevación (mm)": "4500 kg" } }), null);
});

test("los tractores de arrastre publican arrastre y no capacidad de carga", () => {
  const base = controlledGamForklift();
  const tractor: ProductRecord = {
    ...base,
    title: "Tractor de arrastre eléctrico MARCA MODELO10",
    shortDescription: "Tractor de arrastre eléctrico MARCA MODELO10 de 2500 kg.",
    longDescription: "El tractor de arrastre eléctrico MARCA MODELO10 tiene 2500 kg de capacidad de remolque.",
    specs: { Marca: "MARCA", Modelo: "MODELO10", "Capacidad de carga (kg)": "2500 kg", "Tipo motor": "Eléctrico" }
  };
  assert.equal(resolveEditorialFacts(tractor)?.family, "tractor-arrastre");
  assert.match(resolveReusableEditorial(tractor).general ?? "", /capacidad de arrastre de 2\.500 kg/u);
  const prepared = prepareSourceProduct(tractor).product;
  assert.equal(prepared.spec["Capacidad de carga (kg)"], undefined);
  assert.equal(prepared.spec["Capacidad de arrastre"], "2500 kg");
  const other = { ...tractor, specs: { ...tractor.specs, "Capacidad de arrastre": "1200 kg" } };
  assert.equal(prepareSourceProduct(other).product.spec["Capacidad de carga (kg)"], "2500 kg");
});

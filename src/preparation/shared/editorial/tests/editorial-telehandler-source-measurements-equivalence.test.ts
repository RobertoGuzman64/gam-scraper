import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const original = (reference: string): ProductRecord => accreditedSourceRecord("gomariz-special-original", reference);

const newUnit = (source: ProductRecord): ProductRecord => ({
  ...source,
  reference: `${source.reference}-NUEVA`,
  url: `${source.url?.replace(/\/$/u, "")}-unidad-nueva/`,
  year: null,
  horometer: null,
  serialNumber: null,
  shortDescription: null,
  longDescription: null,
  specs: {
    ...source.specs,
    "Altura de trabajo": "12.6 m",
    "Alcance lateral": "8.4 m",
    "Altura almacenaje": "2.75 m"
  }
});

test("el manipulador histórico conserva altura de trabajo, alcance y altura de almacenaje con conceptos distintos", () => {
  for (const [reference, work, lateral, stored, capacity] of [
    ["MT1661", 13.8, 9.25, 2.59, 4000],
    ["MT1659", 13.8, 9.25, 2.59, 4000],
    ["MT1314", 13.78, 9.6, 2.59, 3500]
  ] as const) {
    const source = original(reference);
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "manipulador-telescopico");
    assert.equal(facts?.workingHeightM, work);
    assert.equal(facts?.lateralReachM, lateral);
    assert.equal(facts?.storedHeightM, stored);
    assert.equal(facts?.liftingHeightM, null);
    assert.equal(facts?.loadCapacityKg, capacity);
    const signed = resolveKnowledgeEditorial(source, source).fallbackGeneral;
    assert.ok(signed);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    const general = prepared.product.description_general ?? "";
    for (const snippet of [
      `altura de trabajo de ${String(work).replace(".", ",")} m`,
      `alcance lateral de ${String(lateral).replace(".", ",")} m`,
      `altura de almacenaje de ${String(stored).replace(".", ",")} m`
    ]) assert.ok(general.includes(snippet), `${reference}: ${snippet}`);
    assert.doesNotMatch(general, /altura de elevación de /u);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("una unidad nueva compatible utiliza únicamente sus tres magnitudes y no la firma anterior", () => {
  const source = original("MT1661");
  const next = newUnit(source);
  const sourceSnapshot = JSON.stringify(source);
  const nextSnapshot = JSON.stringify(next);
  const facts = resolveEditorialFacts(next);
  assert.equal(facts?.workingHeightM, 12.6);
  assert.equal(facts?.lateralReachM, 8.4);
  assert.equal(facts?.storedHeightM, 2.75);
  const shared = resolveReusableEditorial(next).general ?? "";
  const prepared = prepareSourceProduct(next);
  assert.equal(prepared.status, "ready");
  assert.equal(resolveKnowledgeEditorial(next, next).fallbackGeneral, null);
  for (const snippet of ["altura de trabajo de 12,6 m", "alcance lateral de 8,4 m", "altura de almacenaje de 2,75 m"]) {
    assert.ok(shared.includes(snippet), snippet);
    assert.ok(prepared.product.description_general?.includes(snippet), snippet);
  }
  for (const old of ["13,8 m", "9,25 m", "2,59 m"]) {
    assert.ok(!shared.includes(old), old);
    assert.ok(!prepared.product.description_general?.includes(old), old);
  }
  assert.equal(JSON.stringify(source), sourceSnapshot);
  assert.equal(JSON.stringify(next), nextSnapshot);
});

test("el consenso por modelo solo es contexto para una unidad sin alcance propio", () => {
  const source = original("MT1661");
  const next = newUnit(source);
  const specs = { ...next.specs };
  delete specs["Alcance lateral"];
  const withoutReach = { ...next, specs };
  assert.equal(resolveEditorialFacts(withoutReach)?.lateralReachM, null);
  assert.doesNotMatch(resolveReusableEditorial(withoutReach).general ?? "", /alcance lateral de /u);
  const knowledge = resolveKnowledgeEditorial(withoutReach, withoutReach);
  assert.match(knowledge.modelReference ?? "", /otras fichas del catálogo del modelo Jcb 540-140/u);
  assert.match(knowledge.modelReference ?? "", /alcance lateral de 9,25 m/u);
  assert.match(knowledge.modelReference ?? "", /no acreditan por sí solos la configuración de esta unidad/u);
  const prepared = prepareSourceProduct(withoutReach);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description_general ?? "", /Como referencia, otras fichas/u);
  assert.doesNotMatch((prepared.product.description_general ?? "").split("Como referencia")[0] ?? "", /alcance lateral de /u);
});

test("el alcance ambiguo se excluye sin perder la altura y capacidad acreditadas", () => {
  const source = original("MT1329");
  const facts = resolveEditorialFacts(source);
  assert.equal(source.specs?.["Alcance lateral"], "10.2 m, 3.40 m");
  assert.equal(facts?.lateralReachM, null);
  assert.equal(facts?.workingHeightM, 5.85);
  assert.equal(facts?.storedHeightM, 1.92);
  const general = prepareSourceProduct(source).product.description_general ?? "";
  assert.match(general, /altura de trabajo de 5,85 m/u);
  assert.match(general, /altura de almacenaje de 1,92 m/u);
  assert.doesNotMatch(general, /alcance lateral de /u);
});

test("valores opcionales, magnitudes incompatibles y ausencia no producen afirmaciones", () => {
  const source = original("MT1661");
  for (const value of ["Opcional", "9.25 kg", "9.25 m o 10 m", "sin dato"]) {
    const changed = { ...source, specs: { ...source.specs, "Alcance lateral": value } };
    assert.equal(resolveEditorialFacts(changed)?.lateralReachM, null);
    assert.doesNotMatch(resolveReusableEditorial(changed).general ?? "", /alcance lateral de /u);
  }
  const noReach = { ...source, specs: { ...source.specs } };
  delete noReach.specs["Alcance lateral"];
  assert.equal(resolveEditorialFacts(noReach)?.lateralReachM, null);
  const noHeight = { ...source, specs: { ...source.specs } };
  delete noHeight.specs["Altura de trabajo"];
  assert.equal(resolveEditorialFacts(noHeight)?.workingHeightM, null);
  const incompatible = { ...source, specs: { ...source.specs, "Altura de trabajo": "13.8 kg" } };
  assert.equal(resolveEditorialFacts(incompatible), null);
});

test("fuente, identidad, familia y condición ajenas no habilitan medidas del original", () => {
  const source = original("MT1661");
  for (const changed of [
    { ...source, providerId: "otro" },
    { ...source, url: "https://example.invalid/venta/manipulador/jcb-540-140/" },
    { ...source, model: "OTRO-MODELO" },
    { ...source, condition: "Nuevo" as const },
    { ...source, title: "Plataforma de tijera JCB 540-140" }
  ]) {
    assert.equal(resolveEditorialFacts(changed), null);
    assert.equal(resolveKnowledgeEditorial(changed, changed).fallbackGeneral, null);
    assert.doesNotMatch(resolveReusableEditorial(changed).general ?? "", /alcance lateral de 9,25 m/u);
  }
});

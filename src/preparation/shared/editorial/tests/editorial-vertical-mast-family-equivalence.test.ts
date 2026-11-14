import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const gomariz = accreditedSourceRecord("gomariz-original", "PV556");
const mercaeleva = accreditedSourceRecord("mercaeleva-original", "M028-8481");

const nextGomarizUnit = (reference: string, load: string, height: string): ProductRecord => ({
  ...gomariz,
  reference,
  url: `${gomariz.url.replace(/\/$/u, "")}-${reference.toLowerCase()}/`,
  image: null,
  images: [],
  shortDescription: null,
  longDescription: null,
  specs: { ...gomariz.specs, Capacidad: load, "Altura de trabajo": height }
});

test("RE033: originales de mástil vertical mantienen identidad de familia en dos proveedores", () => {
  for (const source of [gomariz, mercaeleva]) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(facts?.family, "plataforma-mastil", source.reference ?? "");
    assert.equal(prepared.status, "ready", source.reference ?? "");
    assert.equal(prepared.product.reference, source.reference);
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.equal(JSON.stringify(source), snapshot);
  }
  assert.equal(resolveEditorialFacts(gomariz)?.loadCapacityKg, 363);
  assert.equal(resolveEditorialFacts(gomariz)?.workingHeightM, 4.5);
  assert.equal(resolveEditorialFacts(mercaeleva)?.workingHeightM, 10);
  assert.match(resolveReusableEditorial(mercaeleva).short ?? "", /Equipo de mástil vertical eléctrico Genie GR-15/u);
  assert.doesNotMatch(resolveReusableEditorial(gomariz).short ?? "", /Plataforma de mástil vertical/u);
  const baseGomariz = nextGomarizUnit("PV557", "350 kg", "5.00 m");
  const electricGomariz: ProductRecord = { ...baseGomariz, specs: { ...baseGomariz.specs, Motor: "Eléctrico" } };
  assert.match(prepareSourceProduct(electricGomariz).product.title ?? "", /Equipo de mástil vertical eléctrico Genie SLA15/u);
  assert.match(prepareSourceProduct(gomariz).product.description_general ?? "", /elevador de materiales/u);
});

test("RE033: una nueva unidad compatible reutiliza la regla con carga y altura propias", () => {
  for (const [source, capacity, work, previousCapacity, previousWork] of [
    [nextGomarizUnit("PV557", "350 kg", "5.00 m"), "350", "5", "363", "4,5"],
    [nextGomarizUnit("PV558", "320 kg", "4.20 m"), "320", "4,2", "350", "5"]
  ] as const) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "plataforma-mastil");
    assert.equal(facts?.loadCapacityKg, Number(capacity));
    assert.equal(resolveKnowledgeEditorial(source).general, null);
    const shared = resolveReusableEditorial(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.reference, source.reference);
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.match(shared.general ?? "", new RegExp(`capacidad de ${capacity} kg`, "u"));
    assert.match(shared.general ?? "", new RegExp(`altura de trabajo de ${work} m`, "u"));
    assert.match(prepared.product.description_general ?? "", new RegExp(`capacidad de carga de ${capacity} kg`, "u"));
    assert.ok((prepared.product.title ?? "").includes(`${work} m de trabajo`));
    assert.doesNotMatch(shared.general ?? "", new RegExp(`capacidad de ${previousCapacity} kg`, "u"));
    assert.doesNotMatch(shared.general ?? "", new RegExp(`altura de trabajo de ${previousWork} m`, "u"));
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE033: títulos de otras familias no heredan medidas de un mástil vertical", () => {
  for (const source of [gomariz, mercaeleva]) {
    const altered = { ...source, title: `${source.brand} ${source.model} carretilla elevadora` };
    assert.equal(resolveEditorialFacts(altered), null);
    assert.deepEqual(resolveReusableEditorial(altered), { short: null, general: null });
  }
});

test("RE033: identidad, procedencia y unidades técnicas incompatibles quedan excluidas", () => {
  for (const source of [gomariz, mercaeleva]) {
    for (const changed of [
      { ...source, providerId: "proveedor-invalido" },
      { ...source, url: "https://example.invalid/mastil-vertical" },
      { ...source, brand: "MARCA AJENA" },
      { ...source, model: "MODELO AJENO" }
    ]) {
      assert.equal(resolveEditorialFacts(changed), null);
      assert.deepEqual(resolveReusableEditorial(changed), { short: null, general: null });
    }
  }
  const invalid = nextGomarizUnit("PV557", "350 m", "5.00 kg");
  assert.equal(resolveEditorialFacts(invalid)?.loadCapacityKg ?? null, null);
  assert.equal(resolveEditorialFacts(invalid)?.workingHeightM ?? null, null);
  assert.doesNotMatch(resolveReusableEditorial(invalid).general ?? "", /capacidad de 350 kg|altura de trabajo de 5 m/u);
});

test("RE033 no acredita alturas técnicas contradictorias de otra capacidad", () => {
  assert.match(mercaeleva.title ?? "", /6 MT/u);
  assert.equal(mercaeleva.specs?.["Altura de trabajo"], "10 m");
  assert.equal(resolveEditorialFacts(mercaeleva)?.family, "plataforma-mastil");
  assert.equal(prepareSourceProduct(mercaeleva).status, "ready");
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const original = (reference: string): ProductRecord => accreditedSourceRecord("gomariz-original", reference);

const newUnit = (source: ProductRecord, storedHeight: string): ProductRecord => ({
  ...source,
  reference: `${source.reference}-NUEVA`,
  url: `${source.url.replace(/\/$/u, "")}-unidad-nueva/`,
  year: null,
  horometer: null,
  serialNumber: null,
  shortDescription: null,
  longDescription: null,
  specs: { ...source.specs, "Altura almacenaje": storedHeight }
});

test("las alturas históricas de almacenaje de carretillas y barredoras permanecen distintas de elevación y trabajo", () => {
  for (const [reference, family, height, load] of [
    ["CAE1207", "carretilla-elevadora", 2.23, 2500],
    ["CA1041", "carretilla-elevadora", 2.11, 2000],
    ["BR901", "barredora", 1.25, null]
  ] as const) {
    const source = original(reference);
    const originalSnapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, family);
    assert.equal(facts?.storedHeightM, height);
    assert.equal(facts?.liftingHeightM, null);
    assert.equal(facts?.loadCapacityKg, load);
    const general = prepareSourceProduct(source);
    assert.equal(general.status, "ready");
    assert.ok(general.product.description_general?.includes(`altura de almacenaje de ${String(height).replace(".", ",")} m`));
    assert.doesNotMatch(general.product.description_general ?? "", /altura de elevación de /u);
    assert.equal(JSON.stringify(source), originalSnapshot);
  }
});

test("una unidad nueva reutiliza la magnitud que declara, no el valor ni la firma del original", () => {
  for (const [reference, replacement, inherited] of [
    ["CAE1207", "2.35 m", "2,23 m"],
    ["CA1041", "2.42 m", "2,11 m"],
    ["BR901", "1.45 m", "1,25 m"]
  ] as const) {
    const source = original(reference);
    const unit = newUnit(source, replacement);
    const unitSnapshot = JSON.stringify(unit);
    const expected = replacement.replace(".", ",");
    assert.equal(resolveKnowledgeEditorial(unit, unit).fallbackGeneral, null);
    assert.equal(resolveEditorialFacts(unit)?.storedHeightM, Number(replacement.split(" ")[0]));
    const reusable = resolveReusableEditorial(unit).general ?? "";
    const prepared = prepareSourceProduct(unit);
    assert.equal(prepared.status, "ready");
    assert.ok(reusable.includes(`altura de almacenaje de ${expected}`));
    assert.ok(prepared.product.description_general?.includes(`altura de almacenaje de ${expected}`));
    assert.ok(!prepared.product.description_general?.includes(inherited));
    assert.equal(JSON.stringify(unit), unitSnapshot);
  }
});

test("una altura ausente, ambigua, opcional o expresada con magnitud incompatible no se afirma", () => {
  for (const reference of ["CAE1207", "BR901"]) {
    const source = original(reference);
    for (const value of ["Opcional", "2.35 kg", "2.35 m o 2.50 m", "sin dato", "0.3 m", "35 m"]) {
      const unit = newUnit(source, value);
      assert.equal(resolveEditorialFacts(unit)?.storedHeightM ?? null, null, value);
      assert.doesNotMatch(resolveReusableEditorial(unit).general ?? "", /altura de almacenaje de /u);
      assert.doesNotMatch(prepareSourceProduct(unit).product.description_general ?? "", /altura de almacenaje de /u);
    }
    const withHeight = newUnit(source, "2.35 m");
    const specs = { ...withHeight.specs };
    delete specs["Altura almacenaje"];
    const noHeight = { ...withHeight, specs };
    assert.equal(resolveEditorialFacts(noHeight)?.storedHeightM, null);
    assert.doesNotMatch(prepareSourceProduct(noHeight).product.description_general ?? "", /altura de almacenaje de /u);
  }
});

test("una familia contradictoria o una firma de otra procedencia no habilitan la altura histórica", () => {
  const source = original("CAE1207");
  const incompatible = {
    ...newUnit(source, "2.35 m"),
    title: "Plataforma de tijera Nissan Q02L25CU",
    categoryName: "Plataformas de tijera"
  };
  assert.equal(resolveEditorialFacts(incompatible), null);
  assert.doesNotMatch(prepareSourceProduct(incompatible).product.description_general ?? "", /altura de almacenaje de /u);
  const otherProvider = { ...newUnit(source, "2.35 m"), providerId: "otro" };
  assert.equal(resolveKnowledgeEditorial(otherProvider, source).fallbackGeneral, null);
  assert.doesNotMatch(prepareSourceProduct(otherProvider).product.description_general ?? "", /2,23 m/u);
});

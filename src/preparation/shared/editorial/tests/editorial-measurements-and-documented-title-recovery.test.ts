import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveDocumentedEditorialTitle } from "../domain/editorial-documented-title.js";
import { resolveMercaelevaEditorialDomainSource } from "../../../mercaeleva/editorial/mapping/domain-source.js";
import { controlledGamForklift, controlledMercaelevaForklift, controlledMercaelevaPlatform } from "./editorial-contract-records.js";

const mercaElevation = (value: string): ProductRecord => {
  const basis = controlledMercaelevaForklift();
  return { ...basis, specs: { ...basis.specs, "Altura máxima de elevación": value } };
};

const gamOruga = (reach: string): ProductRecord => {
  const basis = controlledGamForklift();
  return {
    ...basis,
    title: "Plataforma sobre orugas MARCA MODELO10",
    url: `https://online.gamrentals.com/es/cte/${basis.reference}-plataforma-sobre-orugas-marca-modelo10`,
    specs: { Marca: "MARCA", Modelo: "MODELO10", "Alcance Lateral": reach }
  };
};

const gamRadius = (radius: string): ProductRecord => {
  const basis = controlledGamForklift();
  return {
    ...basis,
    specs: { ...basis.specs, "Radio de giro": radius },
    longDescription: "La carretilla MARCA MODELO10 declara un radio de giro de 1,98 m."
  };
};

const documentedScissor = (height: string): ProductRecord => {
  const basis = controlledMercaelevaPlatform();
  return {
    ...basis,
    condition: "Segunda mano",
    title: "MARCA MODELO10 PLATAFORMA DE TIJERA ELECTRICA",
    longDescription: `La plataforma tijera electrica altura de trabajo ${height} mt MARCA MODELO10 está documentada.`,
    specs: {
      Marca: "MARCA", Modelo: "MODELO10", Estado: "Usado",
      "Título adicional": "PLATAFORMA DE TIJERA ELECTRICA",
      "Altura de trabajo": `${height} m`, "Tipo de motor": "Eléctrico"
    }
  };
};

test("elevación de origen mm/m se conserva sin alterar la ficha ni necesitar referencia acreditada", () => {
  for (const raw of ["4500 mm", "4.500 mm", "4,5 m"]) {
    const source = mercaElevation(raw);
    const original = JSON.stringify(source);
    assert.equal(resolveEditorialFacts(source)?.liftingHeightM, 4.5);
    assert.equal(JSON.stringify(source), original);
    const next = { ...source, reference: "OTRA-UNIDAD", url: source.url?.replace("CONTROL-04", "OTRA-UNIDAD") ?? null };
    assert.equal(resolveEditorialFacts(next)?.liftingHeightM, 4.5);
  }
  for (const raw of ["4500 m", "4,5 kg", "4500", "4 m metros", "70000 mm"]) {
    assert.equal(resolveMercaelevaEditorialDomainSource(mercaElevation(raw))?.liftingHeight !== undefined, true);
    assert.equal(resolveEditorialFacts(mercaElevation(raw)), null);
  }
  const contradictory = mercaElevation("4500 mm");
  assert.equal(resolveEditorialFacts({ ...contradictory, specs: { ...contradictory.specs, "Altura de elevación (mm)": "4700 mm" } }), null);
  assert.equal(resolveEditorialFacts({ ...contradictory, url: "https://example.invalid/es/for-sale/machine/CONTROL-04" }), null);
  assert.equal(resolveEditorialFacts({ ...contradictory, model: "MODELO11" }), null);
  assert.equal(resolveEditorialFacts({ ...contradictory, condition: "Nuevo", specs: { ...contradictory.specs, Estado: "Usado" } }), null);
});

test("alcance lateral solo con familia reconocida y procedencia concordante", () => {
  const source = gamOruga("8,2 metros");
  assert.equal(resolveEditorialFacts(source)?.lateralReachM, 8.2);
  assert.match(resolveReusableEditorial(source).short ?? "", /alcance lateral de 8,2 m/u);
  const next = { ...source, reference: "NUEVA-ORUGA", url: source.url?.replace("CONTROL-03", "NUEVA-ORUGA") ?? null };
  assert.equal(resolveEditorialFacts(next)?.lateralReachM, 8.2);
  assert.equal(resolveEditorialFacts({ ...source, specs: { ...source.specs, "Alcance lateral": "9 m" } }), null);
  assert.equal(resolveEditorialFacts(gamOruga("8,2 m metros")), null);
  assert.equal(resolveEditorialFacts({ ...source, longDescription: "La plataforma MARCA MODELO10 declara alcance lateral de hasta 7,5 m." }), null);
  assert.equal(resolveEditorialFacts({ ...source, providerId: "mercaeleva" }), null);
  assert.equal(resolveEditorialFacts({ ...source, model: "MODELO11" }), null);
  assert.equal(resolveEditorialFacts({ ...source, title: "Carretilla elevadora MARCA MODELO10", url: source.url?.replace("plataforma-sobre-orugas", "carretilla") ?? null })?.lateralReachM ?? null, null);
});

test("radio métrico acreditado por fuente y preparado, pero no propagado entre unidades", () => {
  const source = gamRadius("1,98 m");
  assert.equal(resolveEditorialFacts(source)?.turningRadiusM, 1.98);
  assert.match(resolveReusableEditorial(source).general ?? "", /radio de giro declarado de 1,98 m/u);
  const prepared = { ...source, specs: { ...source.specs, "Radio de giro": "1980mm" } };
  assert.equal(resolveReusableEditorial(prepared, null, source).general?.includes("radio de giro declarado de 1,98 m"), true);
  assert.doesNotMatch(resolveReusableEditorial(prepared, null, { ...source, reference: "OTRA-UNIDAD" }).general ?? "", /radio de giro/u);
  assert.doesNotMatch(resolveReusableEditorial(prepared, null, { ...source, condition: "Nuevo" }).general ?? "", /radio de giro/u);
  assert.equal(resolveEditorialFacts({ ...source, longDescription: "La carretilla MARCA MODELO10 declara un radio de giro de 2,18 m." })?.turningRadiusM, null);
  assert.equal(resolveEditorialFacts(gamRadius("1980"))?.turningRadiusM, null);
  assert.equal(resolveEditorialFacts(gamRadius("19,8 m"))?.turningRadiusM, null);
});

test("título técnico de tijera documentada admite alturas equivalentes sin caso fijo 8 m", () => {
  for (const height of ["8", "9", "10,5"]) {
    const source = documentedScissor(height);
    const expected = `Plataforma de tijera eléctrica MARCA MODELO10 de ${height} m`;
    assert.equal(resolveDocumentedEditorialTitle(source), expected);
    const other = { ...source, reference: "CONTROL-OTRA", url: source.url?.replace("CONTROL-02", "CONTROL-OTRA") ?? null };
    assert.equal(resolveDocumentedEditorialTitle(other), expected);
  }
  const source = documentedScissor("9");
  assert.equal(resolveDocumentedEditorialTitle({ ...source, longDescription: "MARCA MODELO10 plataforma tijera electrica altura de trabajo 10 mt" }), null);
  assert.equal(resolveDocumentedEditorialTitle({ ...source, specs: { ...source.specs, "Altura de trabajo": "9000 kg" } }), null);
  assert.equal(resolveDocumentedEditorialTitle({ ...source, model: "MODELO11" }), null);
  assert.equal(resolveDocumentedEditorialTitle({ ...source, url: "https://example.invalid/for-sale/machine/CONTROL-02" }), null);
  assert.equal(resolveDocumentedEditorialTitle({ ...source, condition: "Nuevo" }), null);
  assert.equal(resolveDocumentedEditorialTitle({ ...source, specs: { ...source.specs, "Tipo de motor": "Diesel" } }), null);
});

test("M23: preparación reutiliza hechos y títulos nuevos sin promover contradicciones", () => {
  const forklift = mercaElevation("4500 mm");
  const newUnit = { ...forklift, reference: "MUESTRA-OTRA", url: forklift.url?.replace("CONTROL-04", "MUESTRA-OTRA") ?? null };
  const prepared = prepareSourceProduct(newUnit);
  assert.equal(prepared.product.reference, "MUESTRA-OTRA");
  assert.equal(prepared.product.title, newUnit.title);
  assert.match(prepared.product.description_general ?? "", /altura de elevación de 4,5 m/u);
  assert.equal(prepared.product.sourceUrl, newUnit.url);

  const oruga = gamOruga("8,2 metros");
  const preparedOruga = prepareSourceProduct(oruga);
  assert.match(preparedOruga.product.description_general ?? "", /alcance lateral de 8,2 m/u);
  const disputed = { ...oruga, longDescription: "La plataforma MARCA MODELO10 declara alcance lateral de hasta 7,5 m." };
  assert.doesNotMatch(prepareSourceProduct(disputed).product.description_general ?? "", /alcance lateral de 8,2 m/u);

  const scissor = documentedScissor("9");
  const preparedScissor = prepareSourceProduct(scissor);
  assert.equal(preparedScissor.product.title, "Plataforma de tijera eléctrica MARCA MODELO10 de 9 m");
  assert.equal(preparedScissor.product.description_title, preparedScissor.product.title);
});

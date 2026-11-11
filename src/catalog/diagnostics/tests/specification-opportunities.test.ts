import assert from "node:assert/strict";
import test from "node:test";
import { analyzeTechnicalDensity } from "../technical-density.js";
import { analyzeSpecificationCoverage } from "../specification-coverage.js";
import { analyzeSpecificationOpportunities } from "../specification-opportunities.js";
import type { DescriptionCoverageInput } from "../description-coverage.js";
import type { ProductRecord, SpecValue } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";

const input = (reference: string, sourceSpecs: Readonly<Record<string, SpecValue>>,
  preparedSpecs: Readonly<Record<string, SpecValue>>, publishedSpecs: Readonly<Record<string, SpecValue>>,
  brand = "Marca", model = "Modelo"): DescriptionCoverageInput => {
  const url = `https://example.com/maquina/${reference}`;
  const source: ProductRecord = {
    providerId: "gam", reference, url, categoryKey: "maquinas", categoryName: "Maquinaria",
    title: `Equipo ${reference}`, brand, model, shortDescription: null, longDescription: null,
    price: null, year: null, location: null, country: null, horometer: null,
    serialNumber: null, image: null, specs: sourceSpecs
  };
  const product: ImportCandidate = {
    providerId: "gam", sourceUrl: url, reference, title: source.title,
    categorySellID: null, category: "Maquinaria", condition: null, price: null,
    description_title: source.title, description: null, description_general: null,
    image: null, images: [], spec: { Marca: brand, Modelo: model, ...preparedSpecs }, attributes: []
  };
  return { source, prepared: { status: "ready", issues: [], product },
    published: { ...product, spec: { Marca: brand, Modelo: model, ...publishedSpecs } }, origin: "original_canonico" };
};
const analyze = (inputs: readonly DescriptionCoverageInput[]) => analyzeSpecificationOpportunities(
  inputs, analyzeTechnicalDensity(inputs.map((item) => item.published)), analyzeSpecificationCoverage(inputs)
);

test("el objetivo de seis prioriza evidencias propias y no cuenta metadatos como prestaciones", () => {
  const inputs = [
    input("1", { Peso: "100 kg" }, {}, {}),
    input("2", { Capacidad: "200 kg" }, { Capacidad: "200 kg" }, {}),
    input("3", {}, {}, { Peso: "110 kg", Ancho: "1 m", Altura: "2 m", Velocidad: "3 km/h", Capacidad: "200 kg", Motor: "Eléctrico" })
  ];
  const before = JSON.stringify(inputs);
  const result = analyze(inputs);
  assert.equal(result.totals.belowTarget, 2);
  assert.equal(result.totals.missingToTarget, 12);
  assert.equal(result.totals.preparedEvidence, 1);
  assert.equal(result.totals.sourceEvidence, 1);
  assert.equal(result.totals.withoutClues, 0);
  assert.deepEqual(result.cases.map((item) => [item.reference, item.evidence]),
    [["2", "preparada_sin_publicar"], ["1", "origen_sin_preparar"]]);
  assert.deepEqual(result.cases[0]?.preparedKeys, ["Capacidad"]);
  assert.deepEqual(result.cases[1]?.sourceKeys, ["Peso (kg)"]);
  assert.equal(JSON.stringify(inputs), before);
});

test("un modelo idéntico sugiere investigación, sin trasladar sus valores a otra unidad", () => {
  const inputs = [
    input("1", {}, {}, {}, "LG", "A14"),
    input("2", { Alcance: "7 m" }, { Alcance: "7 m" }, { Alcance: "7 m" }, "LG", "A14"),
    input("3", { Alcance: "8 m" }, { Alcance: "8 m" }, { Alcance: "8 m" }, "LG", "A14"),
    input("4", {}, {}, {}, "LG", "A15")
  ];
  const result = analyze(inputs);
  assert.equal(result.totals.sameModelEvidence, 1);
  assert.equal(result.totals.withoutClues, 3);
  const first = result.cases.find((item) => item.reference === "1");
  assert.equal(first?.evidence, "mismo_modelo");
  assert.deepEqual(first?.sameModelKeys, ["Alcance"]);
  assert.deepEqual(result.cases.find((item) => item.reference === "4")?.sameModelKeys, []);
});

test("los patrones familiares se mantienen como hipótesis y las pistas sin evidencia no abren incidencias", () => {
  const inputs = [
    input("1", {}, {}, {}, "LG", "A1"),
    input("2", { "Altura de trabajo": "8 m" }, { "Altura de trabajo": "8 m" }, { "Altura de trabajo": "8 m" }, "LG", "A2"),
    input("3", { "Altura de trabajo": "9 m" }, { "Altura de trabajo": "9 m" }, { "Altura de trabajo": "9 m" }, "LG", "A3"),
    input("4", { "Altura de trabajo": "10 m" }, { "Altura de trabajo": "10 m" }, { "Altura de trabajo": "10 m" }, "LG", "A4"),
    input("5", { "Altura de trabajo": "11 m" }, { "Altura de trabajo": "11 m" }, { "Altura de trabajo": "11 m" }, "LG", "A5")
  ];
  const result = analyze(inputs);
  assert.equal(result.totals.familyObservations, 1);
  assert.equal(result.totals.withoutClues, 4);
  const first = result.cases.find((item) => item.reference === "1");
  assert.equal(first?.evidence, "patron_familiar");
  assert.deepEqual(first?.familyKeys, ["Altura de trabajo (mm)"]);
  assert.deepEqual(first?.sourceKeys, []);
  assert.deepEqual(first?.preparedKeys, []);
  assert.throws(() => analyzeSpecificationOpportunities(inputs, analyzeTechnicalDensity([]), analyzeSpecificationCoverage(inputs)),
    /Poblaciones incompatibles/);
});

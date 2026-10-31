import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSpecificationCoverage } from "../specification-coverage.js";
import type { DescriptionCoverageInput } from "../description-coverage.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { SpecValue } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../legacy-export/contracts.js";

const input = (reference: string, sourceSpecs: Readonly<Record<string, SpecValue>>,
  preparedSpecs: Readonly<Record<string, SpecValue>>, publishedSpecs: Readonly<Record<string, SpecValue>>,
  origin: DescriptionCoverageInput["origin"] = "original_canonico"): DescriptionCoverageInput => {
  const url = `https://example.com/maquinaria/${reference}`;
  const source: ProductRecord = {
    providerId: "gam", reference, url, categoryKey: "maquinaria", categoryName: "Maquinaria",
    title: `Equipo ${reference}`, brand: "Marca", model: "Modelo", shortDescription: null,
    longDescription: null, price: null, year: null, location: null, country: null,
    horometer: null, serialNumber: null, image: null, specs: sourceSpecs
  };
  const product: ImportCandidate = {
    providerId: "gam", sourceUrl: url, reference, title: source.title, categorySellID: null, category: "Maquinaria",
    condition: null, price: null, description_title: source.title, description: null,
    description_general: null, image: null, images: [], spec: preparedSpecs, attributes: []
  };
  return { source, prepared: { status: "ready", issues: [], product }, published: { ...product, spec: publishedSpecs }, origin };
};

test("separa recuperaciones, pérdidas técnicas y ausencias relativas sin imponer especificaciones", () => {
  const inputs = [
    input("1", { Marca: "X", Peso: "100" }, { Marca: "X", Peso: "100" }, { Marca: "X", Peso: "100" }),
    input("2", { Peso: "110" }, { Peso: "110" }, {}),
    input("3", { Peso: "120" }, {}, { Peso: "120" }),
    input("4", {}, {}, {}),
    input("5", { Peso: "130" }, { Peso: "130" }, { Peso: "130" }),
    input("6", {}, {}, { Peso: "150" })
  ];
  const before = JSON.stringify(inputs);
  const result = analyzeSpecificationCoverage(inputs);
  assert.equal(result.totals.products, 6);
  assert.equal(result.totals.pendingPublication, 1);
  assert.equal(result.totals.sourceNotPreserved, 1);
  assert.equal(result.totals.lostAfterPublication, 1);
  assert.equal(result.totals.observationalMissing, 1);
  assert.deepEqual(result.cases.filter((item) => item.key === "Peso (kg)").map((item) => [item.reference, item.stage]), [
    ["3", "diferencia_origen_preparacion"], ["6", "perdida_tras_publicacion"],
    ["2", "pendiente_publicacion"], ["4", "sin_evidencia_directa"]
  ]);
  assert.equal(result.patterns.find((item) => item.key === "Peso (kg)")?.comparable, 6);
  assert.equal(JSON.stringify(inputs), before);
});

test("no convierte un patrón pequeño en obligación familiar y protege identidades", () => {
  const inputs = [input("1", { Peso: "100" }, { Peso: "100" }, { Peso: "100" }), input("2", {}, {}, {})];
  const result = analyzeSpecificationCoverage(inputs);
  assert.equal(result.totals.observationalMissing, 0);
  assert.equal(result.patterns.length, 0);
  assert.throws(() => analyzeSpecificationCoverage([...inputs, inputs[0]!]), /duplicada/);
  const changed = { ...inputs[0]!, published: { ...inputs[0]!.published, reference: "distinta" } };
  assert.throws(() => analyzeSpecificationCoverage([changed]), /inconsistente/);
});

test("una reconstrucción publicada no se toma por original independiente", () => {
  const item = input("1", { Modelo: "A" }, { Modelo: "A" }, { Modelo: "A" }, "reconstruccion_publicada");
  const result = analyzeSpecificationCoverage([item]);
  assert.equal(result.totals.canonicalOriginals, 0);
  assert.equal(result.totals.reconstructedSources, 1);
  assert.equal(result.totals.sourceNotPreserved, 0);
});

test("marca las normalizaciones ambiguas sin elegir un valor por su cuenta", () => {
  const item = input("1", { Marca: "X", marca: "Y" }, { Marca: "X", marca: "Y" }, { Marca: "X" });
  const result = analyzeSpecificationCoverage([item]);
  assert.equal(result.totals.ambiguousNormalization, 1);
  assert.equal(result.cases[0]?.stage, "normalizacion_ambigua");
});

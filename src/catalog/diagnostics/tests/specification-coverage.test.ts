import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSpecificationCoverage, classifySpecificationWork } from "../specification-coverage.js";
import type { DescriptionCoverageInput } from "../description-coverage.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { SpecValue } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";

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
  const workload = classifySpecificationWork(result);
  assert.deepEqual(workload.requiresReview.map((item) => item.reference), ["3", "6"]);
  assert.deepEqual(workload.pendingActivation.map((item) => item.reference), ["2"]);
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

test("una ausencia familiar sin evidencia no abre trabajo y una pérdida demostrada sí", () => {
  const clean = analyzeSpecificationCoverage([
    input("1", { Peso: "100" }, { Peso: "100" }, { Peso: "100" }),
    input("2", { Peso: "110" }, { Peso: "110" }, { Peso: "110" }),
    input("3", { Peso: "120" }, { Peso: "120" }, { Peso: "120" }),
    input("4", {}, {}, {}),
    input("5", { Peso: "130" }, { Peso: "130" }, { Peso: "130" })
  ]);
  assert.equal(clean.totals.observationalMissing, 1);
  assert.equal(classifySpecificationWork(clean).requiresReview.length, 0);
  assert.equal(classifySpecificationWork(clean).pendingActivation.length, 0);
  const changed = analyzeSpecificationCoverage([
    input("1", { Peso: "100" }, {}, { Peso: "100" }),
    input("2", { Peso: "110" }, { Peso: "110" }, { Peso: "110" }),
    input("3", { Peso: "120" }, { Peso: "120" }, { Peso: "120" }),
    input("4", {}, {}, {}),
    input("5", { Peso: "130" }, { Peso: "130" }, { Peso: "130" })
  ]);
  assert.equal(changed.totals.observationalMissing, 1);
  assert.deepEqual(classifySpecificationWork(changed).requiresReview.map((item) => item.reference), ["1"]);
});


test("calibración: pérdida demostrada, reparación legítima y reintroducción vuelven a su estado correcto", () => {
  const valid = input("calibrada", { Peso: "100" }, { Peso: "100" }, { Peso: "100" });
  const removeFromPreparation = (): DescriptionCoverageInput => ({ ...valid, prepared: {
    ...valid.prepared, product: { ...valid.prepared.product, spec: {} }
  } });
  const initial = analyzeSpecificationCoverage([valid]);
  assert.equal(initial.cases.length, 0);
  assert.equal(classifySpecificationWork(initial).requiresReview.length, 0);
  const broken = analyzeSpecificationCoverage([removeFromPreparation()]);
  assert.equal(broken.totals.sourceNotPreserved, 1);
  assert.deepEqual(classifySpecificationWork(broken).requiresReview.map((item) => item.stage),
    ["diferencia_origen_preparacion"]);
  const repaired = analyzeSpecificationCoverage([valid]);
  assert.deepEqual(repaired, initial);
  assert.deepEqual(analyzeSpecificationCoverage([removeFromPreparation()]), broken);
});

test("calibración: una ausencia familiar no vinculante nunca oculta una pérdida real", () => {
  const source = [
    input("1", { Peso: "100" }, { Peso: "100" }, { Peso: "100" }),
    input("2", { Peso: "110" }, { Peso: "110" }, { Peso: "110" }),
    input("3", { Peso: "120" }, { Peso: "120" }, { Peso: "120" }),
    input("4", {}, {}, {}),
    input("5", { Peso: "130" }, { Peso: "130" }, { Peso: "130" })
  ];
  const initial = analyzeSpecificationCoverage(source);
  assert.equal(initial.totals.observationalMissing, 1);
  assert.equal(classifySpecificationWork(initial).requiresReview.length, 0);
  const changed = source.map((item) => item.source.reference === "2" ? {
    ...item, prepared: { ...item.prepared, product: { ...item.prepared.product, spec: {} } }
  } : item);
  const regression = analyzeSpecificationCoverage(changed);
  assert.equal(regression.totals.observationalMissing, 1);
  assert.equal(regression.totals.sourceNotPreserved, 1);
  assert.deepEqual(classifySpecificationWork(regression).requiresReview.map((item) => item.reference), ["2"]);
  assert.deepEqual(analyzeSpecificationCoverage(source), initial);
  assert.deepEqual(analyzeSpecificationCoverage(changed), regression);
});

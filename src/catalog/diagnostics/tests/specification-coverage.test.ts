import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSpecificationCoverage, classifySpecificationWork } from "../coverage/specification-coverage.js";
import type { DescriptionCoverageInput } from "../coverage/description-coverage.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { SpecValue } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";

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


test("acredita un valor de hoja de cálculo no utilizable sin convertirlo en pérdida editorial", () => {
  const original = input("hoja-invalida", { "Altura de elevación (mm)": "#VALUE! mm", "Centro de carga": "500 mm" },
    { "Centro de carga": "500 mm" }, { "Centro de carga": "500 mm" });
  const snapshot = structuredClone(original);
  const report = analyzeSpecificationCoverage([original]);
  assert.equal(report.totals.accreditedReconciliations, 1);
  assert.equal(report.totals.sourceNotPreserved, 0);
  assert.equal(report.totals.lostAfterPublication, 0);
  const reconciliation = report.cases.find((item) => item.stage === "reconciliacion_acreditada");
  assert.equal(reconciliation?.key, "Altura de elevación (mm)");
  assert.deepEqual(reconciliation?.reconciliation, {
    originalValue: "#VALUE! mm", destinationKeys: [], classification: "origen_no_utilizable"
  });
  assert.deepEqual(original, snapshot);
  const replaced = { ...original, source: { ...original.source, specs: {
    ...original.source.specs, "Altura de elevación (mm)": "1200 mm"
  } } };
  const invalidated = analyzeSpecificationCoverage([replaced]);
  assert.equal(invalidated.totals.accreditedReconciliations, 0);
  assert.equal(invalidated.totals.sourceNotPreserved, 1);
});

test("el horómetro no disponible requiere evidencia del origen y no acredita reconstrucciones", () => {
  const original = input("horometro-ausente", { Horómetro: "NA horas" }, {}, {});
  const verified = { ...original, source: { ...original.source, horometer: "NA horas" } };
  const accredited = analyzeSpecificationCoverage([verified]);
  assert.equal(accredited.totals.accreditedReconciliations, 1);
  assert.equal(accredited.cases[0]?.stage, "reconciliacion_acreditada");
  assert.deepEqual(accredited.cases[0]?.reconciliation, {
    originalValue: "NA horas", destinationKeys: [], classification: "origen_no_utilizable"
  });
  const withoutEvidence = analyzeSpecificationCoverage([original]);
  assert.equal(withoutEvidence.totals.accreditedReconciliations, 0);
  assert.equal(withoutEvidence.totals.sourceNotPreserved, 1);
  const reconstructed = analyzeSpecificationCoverage([{ ...verified, origin: "reconstruccion_publicada" }]);
  assert.equal(reconstructed.totals.accreditedReconciliations, 0);
  assert.equal(reconstructed.totals.canonicalOriginals, 0);
});

const presentationInput = (providerId: "gomariz" | "manain"): DescriptionCoverageInput => {
  const source: ProductRecord = { ...input("CONTROL-TX2", {}, {}, {}).source,
    providerId, title: providerId === "manain" ? "TX2" : "EQUIPTEST TX2", price: "20000 €", brand: "EQUIPTEST", model: "TX2", condition: "Segunda mano",
    categoryKey: "venta", categoryName: "Maquinaria en venta",
    url: providerId === "gomariz" ? "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/equiptest-tx2/" :
      "https://manain.com/producto/venta-elevacion-tijera-equiptest-tx2/",
    specs: providerId === "gomariz" ? { Capacidad: "230kg", "Altura de trabajo": "8 m", "Altura plataforma": "6.2 m" } :
      { Marca: "EQUIPTEST", Modelo: "TX2", Motor: "Eléctrico", "Nueva o usada": "usada", "Altura trabajo": "9 m",
        "Capacidad carga": "230 kg", "Longitud plataforma": "2,4 m", "Ancho plataforma": "0,8 m" } };
  const prepared = prepareSourceProduct(source);
  return { source, prepared, published: { ...prepared.product, spec: {} },
    origin: providerId === "manain" ? "registro_parcial_verificado" : "original_canonico" };
};

test("la cobertura acredita la transformación productiva desde origen sin exigir el valor en la publicación anterior", () => {
  const item = presentationInput("gomariz");
  const snapshot = structuredClone(item);
  const result = analyzeSpecificationCoverage([item]);
  const proof = result.cases.find((entry) => entry.key === "Capacidad");
  assert.equal(proof?.stage, "reconciliacion_acreditada");
  assert.deepEqual(proof?.reconciliation, { originalValue: "230kg", destinationKeys: ["Capacidad de la cesta"],
    classification: "transformacion_acreditada" });
  assert.deepEqual(item, snapshot);
  for (const spec of [{ ...item.prepared.product.spec, "Capacidad de la cesta": "231 kg" },
    { ...item.prepared.product.spec, "Capacidad de la cesta": "230 m" }]) {
    const changed = analyzeSpecificationCoverage([{ ...item, prepared: { ...item.prepared, product: { ...item.prepared.product, spec } } }]);
    assert.equal(changed.cases.find((entry) => entry.key === "Capacidad")?.stage, "diferencia_origen_preparacion");
  }
  const reconstructed = analyzeSpecificationCoverage([{ ...item, origin: "reconstruccion_publicada" }]);
  assert.equal(reconstructed.totals.accreditedReconciliations, 0);
});

test("un registro parcial acredita solo su propia transformación y no se convierte en original canónico", () => {
  const item = presentationInput("manain");
  const report = analyzeSpecificationCoverage([item]);
  assert.equal(report.totals.products, 1);
  assert.equal(report.totals.canonicalOriginals, 0);
  assert.equal(report.totals.partialOriginals, 1);
  assert.equal(report.totals.reconstructedSources, 0);
  assert.ok(report.cases.some((entry) => entry.origin === "registro_parcial_verificado" &&
    entry.stage === "reconciliacion_acreditada" && entry.reconciliation?.originalValue === "230 kg"));
  const invalid = { ...item, source: { ...item.source, specs: { ...item.source.specs, "Capacidad carga": "231 kg" } } };
  assert.equal(analyzeSpecificationCoverage([invalid]).totals.accreditedReconciliations, 0);
});

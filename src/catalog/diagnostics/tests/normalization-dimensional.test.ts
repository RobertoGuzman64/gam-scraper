import assert from "node:assert/strict";
import test from "node:test";
import type { SpecsMap } from "../../../contracts/catalog.js";
import { normalizeOriginalTechnicalPresentation } from "../../../preparation/technical/technical-presentation.js";
import { inspectNormalizationStage, type NormalizationStageObservation } from "../normalization/normalization-audit.js";
import { compareDimensionalPresentation, inspectDimensionalCoherence } from "../normalization/normalization-dimensional.js";

const evaluated = (stage: NormalizationStageObservation) => {
  const result = inspectDimensionalCoherence(stage);
  if (result.status !== "evaluada") assert.fail("Magnitudes comparables esperadas");
  return result.findings;
};

test("contrasta conversiones exactas de longitud, masa, electricidad, porcentajes y ejes de cesta", () => {
  const specs: SpecsMap = Object.freeze({ "Anchura": "81 cm", "Radio de giro": "6.02 m", "Altura de trabajo (mm)": 12000,
    "Altura de trabajo (m)": "0,368 m", "Peso (kg)": "1250,5 kg", "Voltaje": "48 V", "Pendiente superable (%)": "12,5 %",
    "Dimensiones cesta (mm)": "1,4 x 0,7 m", "Dimensiones horquillas (mm)": "1,2 x 0,1 x 0,04 m" });
  const stage = inspectNormalizationStage("original", specs);
  assert.deepEqual(evaluated(stage), []);
  const before = JSON.stringify(specs);
  const presentation = normalizeOriginalTechnicalPresentation(specs, specs);
  assert.deepEqual(compareDimensionalPresentation(stage, presentation), { status: "evaluada", findings: [] });
  assert.equal(JSON.stringify(specs), before);
  assert.deepEqual(evaluated(inspectNormalizationStage("publicacion", { "Dimensiones cesta (mm)": "1,4 x 0,7 x 0,8 m" })), []);
});

test("la comparación física acredita un factor incorrecto y una pérdida de precisión sin tolerancia", () => {
  const stage = inspectNormalizationStage("preparacion", { "Anchura": "81 cm", "Peso (kg)": "1250,51 kg" });
  const altered: NormalizationStageObservation = { ...stage, specifications: stage.specifications.map((spec) => spec.kind === "interpretada"
    ? { ...spec, normalizedValue: spec.canonicalKey === "Anchura (mm)" ? 81 : 1250.5 } : spec) };
  const findings = evaluated(altered);
  assert.equal(findings.length, 2);
  assert.ok(findings.every(({ cause, assessment }) => cause === "magnitud-normalizada-incompatible" && assessment === "defecto_reproducible"));
  assert.deepEqual(findings[0]?.evidence, [
    { stage: "preparacion", circuit: "entrada-observada", field: "Anchura", present: true, value: "81 cm" },
    { stage: "preparacion", circuit: "normalizador-resultado", field: "Anchura (mm)", present: true, value: 81 }
  ]);
});

test("una divergencia real entre lecturas de separadores queda como hipótesis, no como defecto comercial", () => {
  const stage = inspectNormalizationStage("original", { "Peso (kg)": "12,345 kg" });
  const findings = evaluated(stage);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.cause, "separador-numerico-ambiguo");
  assert.equal(findings[0]?.assessment, "hipotesis");
  assert.deepEqual(findings[0]?.evidence.map((item) => item.present ? item.value : null), ["12,345 kg", 12.345, 12345]);
  assert.equal(inspectDimensionalCoherence(inspectNormalizationStage("original", { "Peso (kg)": "12.345 kg" })).status, "no_evaluable");
});

test("la presentación aislada reconoce unidades equivalentes y acredita alteraciones de magnitud", () => {
  const stage = inspectNormalizationStage("original", { "Anchura": "81 cm" });
  assert.deepEqual(compareDimensionalPresentation(stage, { "Anchura (mm)": "810 mm" }), { status: "evaluada", findings: [] });
  const result = compareDimensionalPresentation(stage, { "Anchura": "810 cm" });
  if (result.status !== "evaluada") assert.fail("Presentación comparable esperada");
  assert.equal(result.findings[0]?.cause, "magnitud-presentada-incompatible");
  assert.equal(result.findings[0]?.assessment, "defecto_reproducible");
  const incompatible = compareDimensionalPresentation(stage, { "Anchura": "81 kg" });
  if (incompatible.status !== "evaluada") assert.fail("Unidad incompatible esperada");
  assert.equal(incompatible.findings[0]?.cause, "unidad-presentada-incompatible");
  const contradicted = compareDimensionalPresentation(stage, { "Anchura (mm)": "81 cm" });
  if (contradicted.status !== "evaluada") assert.fail("Unidad contradictoria esperada");
  assert.equal(contradicted.findings[0]?.cause, "unidad-presentada-incompatible");
  for (const presented of [{ "Anchura": "81" }, { "Anchura": "81 / 90 cm" }, { "Anchura (mm)": 810, "Ancho total": "0,9 m" }]) {
    assert.equal(compareDimensionalPresentation(stage, presented).status, "no_evaluable");
  }
});

test("no considera evaluables metadatos, compuestos, unidades incompatibles ni valores sin unidad acreditada", () => {
  assert.equal(inspectDimensionalCoherence(inspectNormalizationStage("original", { Marca: "Sintética" })).status, "no_aplicable");
  for (const specs of [{ "Anchura": "810" }, { "Anchura (mm)": "81 cm" }, { "Capacidad de carga (kg)": [1200, 1300] }, { "Anchura": "n/a" }]) {
    assert.equal(inspectDimensionalCoherence(inspectNormalizationStage("original", specs)).status, "no_evaluable");
  }
});

test("el contraste de ejes acredita conversiones erróneas y reconoce el redondeo dimensional contractual", () => {
  const stage = inspectNormalizationStage("original", { "Dimensiones horquillas (mm)": "1,2 m x 10 cm x 40 mm" });
  assert.deepEqual(evaluated(stage), []);
  const changed: NormalizationStageObservation = { ...stage, specifications: stage.specifications.map((spec) => spec.kind === "interpretada"
    ? { ...spec, normalizedValue: { largo: 120, ancho: 100, grosor: 40 } } : spec) };
  assert.equal(evaluated(changed)[0]?.cause, "magnitud-eje-incompatible");
  assert.equal(evaluated(changed)[0]?.assessment, "defecto_reproducible");
  const rounded = evaluated(inspectNormalizationStage("original", { "Dimensiones horquillas (mm)": "1200,1234 x 100 x 40 mm" }));
  assert.equal(rounded[0]?.cause, "precision-ejes-normalizados");
  assert.equal(rounded[0]?.assessment, "diferencia_legitima");
});

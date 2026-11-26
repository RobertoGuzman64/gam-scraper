import assert from "node:assert/strict";
import test from "node:test";
import type { SpecsMap } from "../../../contracts/catalog.js";
import { inspectNormalizationStage, type NormalizationStageObservation } from "../normalization/normalization-audit.js";
import { inspectAliasPrecedence, inspectSemanticConservation } from "../normalization/normalization-semantic.js";
import { compareSemanticReconciliation, inspectPresentationReconciliation, inspectSourceReconciliation } from "../normalization/normalization-reconciliation.js";
import type { NormalizationCheckOutcome } from "../normalization/normalization-checks.js";

const findingsOf = (result: NormalizationCheckOutcome) => {
  if (result.status !== "evaluada") assert.fail("Comprobación evaluable esperada");
  return result.findings;
};

test("la concurrencia incompatible y la supresión por un alias inválido conservan todos los candidatos y no eligen precedencia", () => {
  const conflict = inspectNormalizationStage("original", { "Anchura": "1200 mm", "Anchura total": "1500 mm" });
  const findings = findingsOf(inspectAliasPrecedence(conflict));
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.cause, "alias-con-interpretaciones-incompatibles");
  assert.equal(findings[0]?.assessment, "hipotesis");
  assert.deepEqual(findings[0]?.evidence.map((entry) => entry.present ? entry.value : null), ["1200 mm", "1500 mm", 1200, 1500, null]);
  const invalid = findingsOf(inspectAliasPrecedence(inspectNormalizationStage("preparacion", { "Anchura": "1200 mm", "Anchura total": "sin dato" })));
  assert.equal(invalid[0]?.cause, "prestacion-suprimida-por-concurrencia");
  assert.equal(invalid[0]?.assessment, "hipotesis");
  assert.deepEqual(invalid[0]?.evidence.map((entry) => entry.present ? entry.value : null), ["1200 mm", "sin dato", 1200, null, null]);
});

test("alias equivalentes, valores nulos y claves distintas no se convierten en defectos", () => {
  for (const specs of [{ "Anchura": "1,2 m", "Anchura total": "1200 mm" }, { "Anchura": "1200 mm", "Anchura total": "n/a" }]) {
    assert.deepEqual(findingsOf(inspectAliasPrecedence(inspectNormalizationStage("original", specs))), []);
  }
  assert.equal(inspectAliasPrecedence(inspectNormalizationStage("original", { "Anchura": "n/a", "Anchura total": "-" })).status, "no_evaluable");
  assert.equal(inspectAliasPrecedence(inspectNormalizationStage("original", { "Altura de trabajo (m)": 8, "Altura plataforma (m)": 8 })).status, "no_aplicable");
});

test("la supresión de interpretaciones aisladas idénticas acredita una divergencia reproducible sin resolver conflictos técnicos", () => {
  const stage = inspectNormalizationStage("original", { "Anchura": "1,2 m", "Anchura total": "1200 mm" });
  const suppressed: NormalizationStageObservation = { ...stage, specifications: stage.specifications.map((spec) => spec.kind === "interpretada"
    ? { rawKey: spec.rawKey, rawValue: spec.rawValue, canonicalKey: spec.canonicalKey, rule: spec.rule,
      kind: "descartada", assessment: "hipotesis", reasons: ["alias_conflict"] } : spec) };
  const finding = findingsOf(inspectAliasPrecedence(suppressed))[0];
  assert.equal(finding?.cause, "prestacion-suprimida-por-concurrencia");
  assert.equal(finding?.assessment, "defecto_reproducible");
});

test("conserva rangos, alternativas, multiplicidades, dimensiones, condiciones textuales y negaciones admitidas", () => {
  const specs: SpecsMap = Object.freeze({ "Capacidad de la batería (Ah)": "500–700 Ah", "Anchura (mm)": "1200 / 1500 mm",
    "Potencia (kW)": "2 x 5 kW", "Voltaje": "230/400 V", "Dimensiones horquillas (mm)": "1200 x 100 x 40 mm",
    "Dimensiones cesta (mm)": "1200 x 800 x 1100 mm", "Tracción 4x4": false,
    "Batería (V / Ah)": "2 x 48 V / 500 Ah | Li-ion 80 V / 700–800 Ah", "Capacidad de carga (kg)": [1000, 1500] });
  const stage = inspectNormalizationStage("original", specs);
  const before = JSON.stringify(stage);
  assert.deepEqual(findingsOf(inspectSemanticConservation(stage)), []);
  assert.equal(JSON.stringify(stage), before);
});

test("un rango rechazado, una condición y una lista parcialmente interpretada se mantienen como hipótesis", () => {
  const stage = inspectNormalizationStage("original", { "Peso (kg)": "1000–1500 kg", "Carga Máxima (kg)": "1000 kg con estabilizadores",
    "Marca del motor": ["Motor", 2], "Tracción 4x4": "no disponible" });
  const findings = findingsOf(inspectSemanticConservation(stage));
  assert.equal(findings.length, 4);
  assert.ok(findings.every(({ assessment }) => assessment === "hipotesis"));
  assert.deepEqual(findings[0]?.evidence.map((entry) => entry.present ? entry.value : null), ["1000–1500 kg", null]);
  const conflict = inspectNormalizationStage("original", { "Anchura": "1200 / 1500 mm", "Anchura total": "1800 mm" });
  assert.equal(inspectSemanticConservation(conflict).status, "no_evaluable");
  assert.equal(inspectSemanticConservation(inspectNormalizationStage("original", { "Prestación inédita": "1000/1500", "Peso (kg)": "n/a" })).status, "no_aplicable");
});

test("detecta pérdida de estructura y contradicción de una negación explícita", () => {
  const stage = inspectNormalizationStage("publicacion", { "Tracción 4x4": "No", "Potencia (kW)": "2 x 5 kW", "Voltaje": "230/400 V" });
  const altered: NormalizationStageObservation = { ...stage, specifications: stage.specifications.map((spec) => spec.kind === "interpretada"
    ? { ...spec, normalizedValue: spec.rule === "bool" ? true : spec.canonicalKey === "Voltaje" ? [230] : [5] } : spec) };
  const findings = findingsOf(inspectSemanticConservation(altered));
  assert.equal(findings.length, 3);
  assert.equal(findings[0]?.assessment, "defecto_reproducible");
  assert.match(findings[1]?.reason ?? "", /multiplicidad/u);
  assert.match(findings[2]?.reason ?? "", /alternativas/u);
});

test("las reconciliaciones productivas legítimas conservan batería, geometría y disponibilidad sin mutaciones", () => {
  const specs: SpecsMap = Object.freeze({ "Capacidad de la batería": "48/500 V / Ah", "Elevación libre": false, "Ancho total": "1,2 m" });
  const before = JSON.stringify(specs);
  assert.deepEqual(findingsOf(inspectPresentationReconciliation(specs)), []);
  assert.deepEqual(findingsOf(inspectSourceReconciliation(specs)), []);
  assert.equal(JSON.stringify(specs), before);
  assert.deepEqual(findingsOf(inspectSourceReconciliation({ "Capacidad de la batería": "48/500 V / Ah", "Batería (V / Ah)": "80 V / 700 Ah" })), []);
});

test("una reconciliación que elimina, sobrescribe o introduce competencia conserva evidencia de entrada y salida", () => {
  const before = { "Anchura": "1200 mm", "Peso (kg)": 1000 };
  const after = { "Anchura (mm)": 1200, "Peso (kg)": 1500, "Anchura total": "1500 mm" };
  const findings = compareSemanticReconciliation(before, after, "reconciliacion-sintetica", [{ from: "Anchura" }]);
  assert.equal(findings.length, 2);
  assert.equal(findings[0]?.cause, "prestacion-sin-equivalencia-en-reconciliacion");
  assert.equal(findings[1]?.cause, "prestacion-alterada-en-reconciliacion");
  assert.ok(findings.every(({ assessment }) => assessment === "hipotesis"));
  assert.deepEqual(findings[0]?.evidence.map((entry) => entry.present ? entry.value : null), ["1200 mm", null, 1000, 1200, 1500, "1500 mm"]);
  assert.deepEqual(compareSemanticReconciliation({ "Anchura": "1200 mm" }, { "Anchura (mm)": 1200 }, "reconciliacion-sintetica", [{ from: "Anchura" }]), []);
});

test("la competencia introducida por una reconciliación incluye el alias no modificado en ambas etapas", () => {
  const findings = compareSemanticReconciliation({ "Anchura": "1200 mm", "Anchura total": "1500 mm" },
    { "Anchura (mm)": 1200, "Anchura total": "1500 mm" }, "reconciliacion-sintetica", [{ from: "Anchura", to: "Anchura (mm)" }]);
  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0]?.evidence.filter(({ field }) => field === "Anchura total").map((entry) => entry.present ? entry.value : null), ["1500 mm", "1500 mm"]);
});

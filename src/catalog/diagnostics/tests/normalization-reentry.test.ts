import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { inspectNormalizationStage } from "../normalization/normalization-audit.js";
import { compareNormalizationReentry, inspectNormalizationReentry } from "../normalization/normalization-reentry.js";

const stableSpecs = Object.freeze({
  "Altura de trabajo (m)": "8,5 m", "Tracción 4x4": false, "Peso (kg)": 0,
  "Voltaje": "230/400 V", "Dimensiones horquillas (mm)": "1,2 x 0,1 x 0,04 m",
  "Dimensiones cesta (mm)": "0,8 x 1,2 m", "Batería (V / Ah)": "2 x 48 V / 500 Ah | Li-ion 80 V / 700–800 Ah",
  "Potencia (kW)": "2 x 5 kW", "Anchura (mm)": "1200 / 1500 mm", "Tipo de batería": "Li-ion"
});

test("la reentrada conserva escalares, listas, dimensiones y configuraciones admitidas sin serializar", () => {
  const stage = inspectNormalizationStage("original", stableSpecs);
  assert.equal(stage.specifications.length, Object.keys(stableSpecs).length);
  assert.ok(stage.specifications.every(({ kind }) => kind === "interpretada"));
  const snapshot = JSON.stringify(stage);
  assert.deepEqual(inspectNormalizationReentry(stage), { status: "evaluada", findings: [] });
  assert.equal(JSON.stringify(stage), snapshot);
  assert.deepEqual(inspectNormalizationReentry(inspectNormalizationStage("preparacion", {
    "Dimensiones cesta (mm)": "1200 x 800 x 1100 mm", "Dimensiones horquillas (mm)": [1200, 100]
  })), { status: "evaluada", findings: [] });
});

test("no reintroduce desconocidos, descartes o conflictos de la primera interpretación como defectos", () => {
  const stage = inspectNormalizationStage("original", { "Prestación inédita": "texto", "Peso (kg)": "n/a",
    "Anchura": "1,2 m", "Anchura (mm)": 1500 });
  assert.ok(stage.specifications.every(({ kind }) => kind !== "interpretada"));
  assert.deepEqual(inspectNormalizationReentry(stage), { status: "no_evaluable", reason: "Sin prestaciones interpretadas para reintroducir" });
  const mixed = inspectNormalizationStage("preparacion", { "Prestación inédita": "texto", "Peso (kg)": 1000 });
  assert.deepEqual(inspectNormalizationReentry(mixed), { status: "evaluada", findings: [] });
  const aliases = inspectNormalizationStage("original", { "Anchura": "1,2 m", "Anchura (mm)": 1200 });
  assert.deepEqual(inspectNormalizationReentry(aliases), { status: "evaluada", findings: [] });
});

test("el contraste acredita cambios de magnitud, estructura, pérdidas, nuevas interpretaciones y conflictos", () => {
  const input = { "Peso (kg)": 1000, "Voltaje": [230, 400], "Dimensiones cesta (mm)": "800 x 1200 mm",
    "Potencia (kW)": "2 x 5 kW", "Tracción 4x4": false, "Marca": "Marca sintética" };
  const stage = inspectNormalizationStage("publicacion", input);
  const first = normalizeSpecsObject(input);
  const simulated = { ...normalizeSpecsObject(first.normalized), normalized: {
    "Peso (kg)": 1, "Voltaje": [230], "Dimensiones cesta (mm)": { largo: 1200, ancho: 800 },
    "Potencia (kW)": "5 kW x 2", "Altura de trabajo (m)": 8 },
    conflictingKeys: [{ key: "Marca", sources: ["Marca"] }] };
  const findings = compareNormalizationReentry(stage, first.normalized, simulated);
  const byKey = new Map(findings.map((finding) => [finding.specificationKey, finding]));
  assert.equal(findings.length, 6);
  assert.equal(byKey.get("Peso (kg)")?.cause, "valor-alterado-en-reentrada");
  assert.equal(byKey.get("Voltaje")?.cause, "estructura-alterada-en-reentrada");
  assert.equal(byKey.get("Tracción 4x4")?.cause, "perdida-en-reentrada");
  assert.equal(byKey.get("Altura de trabajo (m)")?.cause, "nueva-interpretacion-en-reentrada");
  assert.equal(byKey.get("Marca")?.cause, "conflicto-en-reentrada");
  assert.equal(byKey.get("Potencia (kW)")?.assessment, "hipotesis");
  assert.ok(findings.filter(({ specificationKey }) => specificationKey !== "Potencia (kW)").every(({ assessment }) => assessment === "defecto_reproducible"));
  assert.deepEqual(byKey.get("Tracción 4x4")?.evidence.slice(0, 2), [
    { stage: "publicacion", circuit: "normalizador-resultado", field: "Tracción 4x4", present: true, value: false },
    { stage: "publicacion", circuit: "normalizador-reentrada", field: "Tracción 4x4", present: false }
  ]);
  assert.equal(byKey.get("Altura de trabajo (m)")?.evidence[0].present, false);
  assert.equal(byKey.has("Dimensiones cesta (mm)"), false);
});

test("acredita una pérdida real en la segunda interpretación sin modificar el normalizador", () => {
  const stage = inspectNormalizationStage("original", { "Marca del motor": ["Capacidad", "de", "carga", "(kg)"] });
  const result = inspectNormalizationReentry(stage);
  if (result.status !== "evaluada") assert.fail("Reentrada evaluable esperada");
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.cause, "perdida-en-reentrada");
  assert.equal(result.findings[0]?.assessment, "defecto_reproducible");
  assert.match(result.findings[0]?.reason ?? "", /invalid_value/u);
  assert.deepEqual(result.findings[0]?.evidence, [
    { stage: "original", circuit: "normalizador-resultado", field: "Marca del motor", present: true, value: "Capacidad de carga (kg)" },
    { stage: "original", circuit: "normalizador-reentrada", field: "Marca del motor", present: false },
    { stage: "original", circuit: "entrada-observada", field: "Marca del motor", present: true, value: ["Capacidad", "de", "carga", "(kg)"] }
  ]);
});

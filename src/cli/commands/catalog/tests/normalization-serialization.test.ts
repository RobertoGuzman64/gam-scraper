import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { normalizeSpecsObject } from "../../../../catalog/normalization/normalize-specs.js";
import { normalizationSerializationChecks } from "../../../../catalog/diagnostics/normalization/normalization-serialization.js";
import type { NormalizationCheckOutcome } from "../../../../catalog/diagnostics/normalization/normalization-checks.js";
import { createPreparedSourceFixture } from "../../../../testing/builders/prepared-source-fixture.js";
import { inspectNormalizationProduct } from "../../../../catalog/diagnostics/normalization/normalization-audit.js";
import { compareDirectSeed, compareSeedRoutes, compareSerializedSpecs, compareTechnicalColumns, inspectGamSerialization } from "../audits/normalization-serialization.js";

const source = (specs: SpecsMap): ProductRecord => ({ providerId: "gam", categoryKey: "elevacion", categoryName: "Elevación",
  title: "Modelo sintético", url: "https://example.test/elevacion/modelo", reference: "SINTETICA", shortDescription: "Ficha sintética",
  longDescription: "Descripción", price: null, brand: "Marca", model: "Modelo", year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null, specs });
const findings = (outcome: NormalizationCheckOutcome | Error | undefined) => {
  assert.ok(outcome && !(outcome instanceof Error) && outcome.status === "evaluada");
  return outcome.findings;
};

test("el circuito real CSV–seed conserva comillas, saltos de línea, identificadores y magnitudes sin escribir datos", async () => {
  const record = source({ "Nº de serie": "000023", "Longitud (m)": "4,5 m", "Anchura": "81 cm", "Peso": "1.200 kg",
    "Capacidad de la cesta": "230 kg", "Dato propio": "texto, \"citado\"\nsegunda línea" });
  const snapshot = JSON.stringify(record);
  const result = (await inspectGamSerialization([record])).get(record.url);
  assert.ok(result);
  assert.deepEqual(findings(result["csv-specjson"]), []);
  assert.deepEqual(findings(result["csv-columnas-tecnicas"]), []);
  assert.deepEqual(findings(result["seed-directo"]), []);
  assert.deepEqual(findings(result["seed-via-csv-normalizado"]), []);
  assert.equal(JSON.stringify(record), snapshot);
});

test("acredita alteraciones de specJson y diferencias de valor y tipo entre consumidores", () => {
  const raw = compareSerializedSpecs({ "Nº de serie": "000023", "Peso (kg)": 1200 }, { "Nº de serie": 23 });
  assert.equal(raw.length, 2);
  assert.ok(raw.every(({ assessment }) => assessment === "defecto_reproducible"));
  const route = compareSeedRoutes({ "Peso (kg)": 1200, "Nº de serie": "000023", "Dato ajeno": "x" }, { "Peso (kg)": 1.2, "Nº de serie": 23 });
  assert.equal(route.length, 3);
  assert.equal(route.find(({ specificationKey }) => specificationKey === "Peso (kg)")?.assessment, "defecto_reproducible");
  assert.equal(route.find(({ specificationKey }) => specificationKey === "Nº de serie")?.assessment, "defecto_reproducible");
  assert.equal(route.find(({ specificationKey }) => specificationKey === null)?.assessment, "hipotesis");
});

test("la expansión detecta magnitudes, unidades omitidas y pérdidas, sin exigir igualdad literal", () => {
  const expected = normalizeSpecsObject({ "Capacidad de la cesta": "230 kg", "Altura (mm)": "1500 mm" }).normalized;
  assert.deepEqual(compareTechnicalColumns(expected, { "Capacidad de la cesta": 230, "Altura (mm)": 1500 },
    { "spec__Capacidad de la cesta": "230 kg", "spec__Altura (mm)": "1500 mm" }), []);
  const wrong = compareTechnicalColumns(expected, { "Capacidad de la cesta": 230, "Altura (mm)": 1500 },
    { "spec__Capacidad de la cesta": "230", "spec__Altura (mm)": "1,5 mm" });
  assert.ok(wrong.some(({ cause }) => cause === "unidad-explicita-omitida-en-columna"));
  assert.ok(wrong.some(({ cause, specificationKey }) => cause === "columna-tecnica-divergente" && specificationKey === "Altura (mm)"));
  assert.ok(compareDirectSeed(expected, {}).some(({ assessment }) => assessment === "defecto_reproducible"));
});

test("los conflictos legítimamente bloqueados y las prestaciones ausentes no se cuentan como defectos", async () => {
  const record = source({ peso: "1500", "Peso (kg)": "1200" });
  const outcomes = (await inspectGamSerialization([record])).get(record.url);
  assert.ok(outcomes);
  assert.deepEqual(findings(outcomes["csv-specjson"]), []);
  for (const id of ["csv-columnas-tecnicas", "seed-directo", "seed-via-csv-normalizado"] as const) {
    const outcome = outcomes[id];
    assert.ok(!(outcome instanceof Error) && outcome.status === "no_evaluable");
  }
  const empty = source({});
  const emptyOutcomes = (await inspectGamSerialization([empty])).get(empty.url);
  assert.ok(emptyOutcomes && !(emptyOutcomes["seed-directo"] instanceof Error) && emptyOutcomes["seed-directo"].status === "no_evaluable");
});

test("la cobertura excluye otros proveedores y declara adaptador ausente o error", () => {
  const record = source({ "Peso": "1200 kg" });
  const prepared = createPreparedSourceFixture()(record);
  const observation = inspectNormalizationProduct(record, prepared);
  const input = { source: record, prepared, observation, published: null };
  for (const check of normalizationSerializationChecks) {
    assert.equal(check.evaluate(input).status, "no_evaluable");
    assert.equal(check.evaluate({ ...input, observation: { ...observation, providerId: "manain" } }).status, "no_aplicable");
    assert.throws(() => check.evaluate({ ...input, serializationError: "Lectura fallida" }), /Lectura fallida/u);
  }
});


test("la lectura técnica conserva identidades y columnas dispersas de todo el lote", async () => {
  const a = { ...source({ "Peso": "1.200 kg", "Dato propio": "texto, \"citado\"\nsegunda línea" }), longDescription: "Descripción, \"citada\"\n".repeat(100) };
  const b = { ...source({ "Anchura": "81 cm", "Capacidad de la cesta": "230 kg" }), reference: "SINTETICA-B", url: "https://example.test/elevacion/otro" };
  const batch = await inspectGamSerialization([a, b]);
  assert.deepEqual([...batch.keys()], [a.url, b.url]);
  for (const record of [a, b]) {
    assert.deepEqual(batch.get(record.url), (await inspectGamSerialization([record])).get(record.url));
  }
  await assert.rejects(inspectGamSerialization([a, a]), /Identidad CSV–seed duplicada/u);
});

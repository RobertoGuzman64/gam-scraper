import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { normalizeSpecsObject } from "../../../catalog/normalization/normalize-specs.js";
import { toCsv } from "../../../shared/csv.js";
import { normalizeGamRows } from "../normalization/normalize-rows.js";

const run = (input: string, output: string, report: string, allowUnknown = false) =>
  spawnSync(process.execPath, ["dist/tools/gam/normalize-csv.js", input, output, "--report", report, ...(allowUnknown ? ["--allow-unknown"] : [])], {
    cwd: process.cwd(), encoding: "utf8", timeout: 20000
  });

const sourceCsv = (specJson: string): string => toCsv([{ reference: "GAM-N10", specJson }], ["reference", "specJson"]);

const absent = async (path: string): Promise<void> => { await assert.rejects(access(path)); };

test("N10 conserva la procedencia y clasifica nulidad, unidad, condiciones, rechazo y colisiones", async () => {
  const specs = {
    "Peso (kg)": "1.5 t",
    "Potencia (kW)": "15-20 kW",
    "Año": "28",
    "Altura de trabajo (mm)": null,
    "peso": "1200",
    "Dato propio": "literal"
  };
  const normalized = normalizeSpecsObject(specs);
  assert.deepEqual(normalizeSpecsObject({ "Potencia (kW)": "2 x 15 kW" }).normalized, { "Potencia (kW)": "2 x 15 kW" });
  assert.ok(normalized.discardedSpecs.some((item) => item.key === "Peso (kg)" && item.reason === "unit_mismatch"));
  assert.ok(normalized.discardedSpecs.some((item) => item.key === "Potencia (kW)" && item.reason === "conditional_value"));
  assert.ok(normalized.discardedSpecs.some((item) => item.key === "Año" && item.reason === "invalid_value"));
  assert.ok(normalized.discardedSpecs.some((item) => item.key === "Altura de trabajo (mm)" && item.reason === "null_like"));
  const rows = [{ reference: "GAM-N10", specJson: JSON.stringify(specs) }];
  const stats = await normalizeGamRows(rows, ["reference", "specJson"], { expandSpecColumns: false, maxValuesPerKey: 50 }, async () => {});
  assert.equal(stats.issueCounts.null_like, 1);
  assert.equal(stats.issueCounts.unit_mismatch, 1);
  assert.equal(stats.issueCounts.conditional_value, 1);
  assert.equal(stats.issueCounts.invalid_value, 1);
  assert.equal(stats.issueCounts.unknown_key, 1);
  assert.equal(stats.issueExamples.length, 7);
  assert.equal(stats.issueCounts.alias_conflict, 2);
  assert.ok(stats.issueExamples.every((issue) => issue.row === 1 && issue.reference === "GAM-N10"));
  assert.ok(stats.issueExamples.some((issue) => issue.sourceKey === "Peso (kg)" && issue.originalValue === "1.5 t"));
});

test("N10 informa por referencia la colisión sin sustituir el dato original", async () => {
  const rows = [{ reference: "GAM-C", specJson: JSON.stringify({ peso: "1200", "Peso (kg)": "1500" }) }];
  const original = rows[0]?.specJson;
  const stats = await normalizeGamRows(rows, ["reference", "specJson"], { expandSpecColumns: false, maxValuesPerKey: 50 }, async () => {});
  assert.equal(stats.aliasConflicts["Peso (kg)"], 1);
  assert.equal(stats.issueCounts.alias_conflict, 2);
  assert.ok(stats.issueExamples.some((item) => item.sourceKey === "peso" && item.originalValue === "1200"));
  assert.equal(rows[0]?.specJson, original);
});

test("N11 no publica CSV ni informe con JSON malformado, no objeto o colisión, incluso con --allow-unknown", async () => {
  const dir = await mkdtemp(join(tmpdir(), "equipzilla-normalization-failclosed-"));
  try {
    const input = join(dir, "input.csv");
    const output = join(dir, "output.csv");
    const report = join(dir, "report.json");
    for (const specs of ["{invalid", "[]", "null", "3", JSON.stringify({ peso: "1200", "Peso (kg)": "1500" })]) {
      const original = sourceCsv(specs);
      await writeFile(input, original, "utf8");
      const executed = run(input, output, report, true);
      assert.equal(executed.status, 1, executed.stderr);
      assert.match(executed.stdout, /sin CSV ni informe nuevos/);
      await absent(output);
      await absent(report);
      assert.equal(await readFile(input, "utf8"), original);
    }
    const mixed = toCsv([
      { reference: "GAM-OK", specJson: JSON.stringify({ Marca: "Yale" }) },
      { reference: "GAM-UNKNOWN", specJson: JSON.stringify({ "Dato ajeno": "texto" }) },
      { reference: "GAM-INVALID", specJson: "{invalid" }
    ], ["reference", "specJson"]);
    await writeFile(input, mixed, "utf8");
    const executed = run(input, output, report, true);
    assert.equal(executed.status, 1, executed.stderr);
    assert.match(executed.stdout, /JSON inválidos: 1/);
    assert.match(executed.stdout, /Claves desconocidas: 1/);
    await absent(output);
    await absent(report);
    assert.equal(await readFile(input, "utf8"), mixed);
    assert.deepEqual((await readdir(dir)).sort(), ["input.csv"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("N11 separa la política de claves desconocidas y conserva los artefactos previos al rechazar", async () => {
  const dir = await mkdtemp(join(tmpdir(), "equipzilla-normalization-policy-"));
  try {
    const input = join(dir, "input.csv");
    const output = join(dir, "output.csv");
    const report = join(dir, "report.json");
    await writeFile(input, sourceCsv(JSON.stringify({ "Dato externo": "valor" })), "utf8");
    assert.equal(run(input, output, report).status, 1);
    await absent(output);
    await absent(report);
    assert.equal(run(input, output, report, true).status, 0);
    const saved: unknown = JSON.parse(await readFile(report, "utf8"));
    assert.ok(saved && typeof saved === "object" && !Array.isArray(saved));
    assert.deepEqual(Object.getOwnPropertyDescriptor(saved, "issueCounts")?.value.unknown_key, 1);
    const previousOutput = await readFile(output, "utf8");
    const previousReport = await readFile(report, "utf8");
    await writeFile(input, sourceCsv("{invalid"), "utf8");
    assert.equal(run(input, output, report, true).status, 1);
    assert.equal(await readFile(output, "utf8"), previousOutput);
    assert.equal(await readFile(report, "utf8"), previousReport);
    assert.equal(run(input, input, report, true).status, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("N10 conserva todos los contadores y acota las muestras para datos adversos", async () => {
  const rows = Array.from({ length: 115 }, (_, index) => ({ reference: `GAM-${index}`, specJson: JSON.stringify({ "Año": "28" }) }));
  const stats = await normalizeGamRows(rows, ["reference", "specJson"], { expandSpecColumns: false, maxValuesPerKey: 50 }, async () => {});
  assert.equal(stats.issueCounts.invalid_value, 115);
  assert.equal(stats.issueExamples.length, 80);
});

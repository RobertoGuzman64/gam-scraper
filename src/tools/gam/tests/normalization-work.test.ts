import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { normalizeSpecsObject } from "../../../catalog/normalization/normalize-specs.js";
import { SPEC_KEY_NORMALIZATION } from "../../../catalog/normalization/spec-rules.js";
import { formatNormalizationWork } from "../../../cli/reporting/normalization-work.js";
import { toCsv } from "../../../shared/csv.js";
import { normalizeGamRows } from "../normalization/normalize-rows.js";
import { normalizedValueToScalar } from "../normalization/spec-scalar.js";

test("cuenta todas las claves renombradas, no suma el top 50 y evita equivalencias ambiguas", async () => {
  const aliases = Object.keys(SPEC_KEY_NORMALIZATION)
    .filter((key) => {
      const result = normalizeSpecsObject({ [key]: "123" });
      return result.renamedKeys.length > 0 && Object.values(result.normalized).some((value) => normalizedValueToScalar(value) !== null);
    }).slice(0, 61);
  assert.equal(aliases.length, 61);
  const rows = aliases.map((key, index) => ({ reference: `R-${index}`, specJson: JSON.stringify({ [key]: "123" }) }));
  const stats = await normalizeGamRows(rows, ["reference", "specJson"], { expandSpecColumns: false, maxValuesPerKey: 50 }, async () => {});
  assert.equal(stats.rowsProcessed, 61);
  assert.equal(stats.rowsTransformed, 61);
  assert.equal(stats.renamedKeysTotal, 61);
  assert.equal(stats.renamedKeysTop.length, 50);
  assert.ok(stats.renamedKeysTotal > stats.renamedKeysTop.reduce((count, entry) => count + entry.count, 0));
});

test("mide deltas efectivos, deja intactos JSON inválidos y la segunda pasada es idempotente", async () => {
  const rows = [
    { reference: "A", specJson: '{"marca":"Yale","Peso (kg)":"1.200 kg"}' },
    { reference: "B", specJson: '{"Marca":"Yale"}' },
    { reference: "C", specJson: "{invalid" },
    { reference: "D", specJson: '{"marca":"Yale","Marca":"Yale"}' }
  ];
  const headers = ["reference", "specJson"];
  const stats = await normalizeGamRows(rows, headers, { expandSpecColumns: false, maxValuesPerKey: 50 }, async () => {});
  assert.equal(stats.rowsProcessed, 4);
  assert.equal(stats.rowsTransformed, 2);
  assert.equal(stats.rowsWithInvalidSpecJson, 1);
  assert.equal(stats.renamedKeysTotal, 1);
  assert.equal(stats.technicalValuesTransformed, 1);
  assert.equal(rows[2]?.specJson, "{invalid");
  const again = await normalizeGamRows(rows, headers, { expandSpecColumns: false, maxValuesPerKey: 50 }, async () => {});
  assert.equal(again.rowsTransformed, 0);
  assert.equal(again.renamedKeysTotal, 0);
  assert.equal(again.technicalValuesTransformed, 0);
  assert.match(formatNormalizationWork(stats).join("\n"), /Filas transformadas: 2/);
  assert.doesNotMatch(formatNormalizationWork(stats).join("\n"), /Máquinas únicas|recuperadas/);
});

test("CLI conserva el informe JSON y emite un solo resumen sin modificar el original", async () => {
  const dir = await mkdtemp(join(tmpdir(), "equipzilla-normalization-work-"));
  try {
    const input = join(dir, "origen.csv");
    const output = join(dir, "salida.csv");
    const report = join(dir, "informe.json");
    const source = toCsv([{ reference: "A", specJson: '{"marca":"Yale"}' }], ["reference", "specJson"]);
    await writeFile(input, source, "utf8");
    const executed = spawnSync(process.execPath, ["dist/tools/gam/normalize-csv.js", input, output, "--report", report], {
      cwd: process.cwd(), encoding: "utf8", timeout: 20000
    });
    assert.equal(executed.status, 0, executed.stderr);
    assert.equal((executed.stdout.match(/TRABAJO REALIZADO/g) ?? []).length, 1);
    assert.match(executed.stdout, /Claves técnicas renombradas: 1/);
    assert.equal(await readFile(input, "utf8"), source);
    const saved: unknown = JSON.parse(await readFile(report, "utf8"));
    assert.ok(saved && typeof saved === "object" && !Array.isArray(saved));
    assert.deepEqual(Object.keys(saved).sort(), [
      "inputCsv", "outputCsv", "reportPath", "totalRows", "rowsWithSpecJson",
      "rowsWithInvalidSpecJson", "unknownKeys", "renamedKeysTop", "specsSummary"
    ].sort());
    assert.match(await readFile(output, "utf8"), /Marca/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

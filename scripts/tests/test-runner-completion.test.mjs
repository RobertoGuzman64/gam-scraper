import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isTestRunAccreditable } from "../test-runner-completion.mjs";

const valid = () => ({ success: true, counts: { passed: 3, failed: 0, skipped: 0, todo: 0, cancelled: 0 } });

test("solo acredita todos los informes completos sin incidencias", () => {
  assert.equal(isTestRunAccreditable([valid(), valid()], 2, true, true), true);
  assert.equal(isTestRunAccreditable([], 0, true, true), true);
});

test("rechaza pruebas omitidas incluso cuando el informe de Node indica éxito", () => {
  assert.equal(isTestRunAccreditable([{ ...valid(), counts: { ...valid().counts, skipped: 1 } }], 1, true, true), false);
});

test("rechaza pruebas pendientes o canceladas sin marcar el archivo como correcto", () => {
  for (const key of ["todo", "cancelled"]) {
    assert.equal(isTestRunAccreditable([{ ...valid(), counts: { ...valid().counts, [key]: 1 } }], 1, true, true), false);
  }
});

test("rechaza fallos explícitos, archivos sin pruebas aprobadas y resúmenes incompletos", () => {
  assert.equal(isTestRunAccreditable([{ ...valid(), counts: { ...valid().counts, failed: 1 } }], 1, true, true), false);
  assert.equal(isTestRunAccreditable([{ ...valid(), success: false }], 1, true, true), false);
  assert.equal(isTestRunAccreditable([{ ...valid(), counts: { ...valid().counts, passed: 0 } }], 1, true, true), false);
  assert.equal(isTestRunAccreditable([{ success: true }], 1, true, true), false);
});

test("rechaza informes ausentes y entradas cambiadas durante la ejecución", () => {
  assert.equal(isTestRunAccreditable([valid()], 2, true, true), false);
  assert.equal(isTestRunAccreditable([valid()], 1, false, true), false);
  assert.equal(isTestRunAccreditable([valid()], 1, true, false), false);
});


test("los recuentos reales de node:test impiden acreditar omisiones y pendientes", () => {
  const root = mkdtempSync(join(tmpdir(), "eqt-completion-"));
  try {
    const file = join(root, "mixed.test.mjs");
    writeFileSync(file, 'import test from "node:test"; test("válida", () => {}); test.skip("omitida", () => {}); test.todo("pendiente", () => {});');
    writeFileSync(join(root, "runner.mjs"), `import { run } from "node:test";
for await (const event of run({ files: [${JSON.stringify(file)}] })) {
  if (event.type === "test:summary" && event.data.file) console.log(JSON.stringify(event.data));
}`);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [join(root, "runner.mjs")], { encoding: "utf8", env });
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const summary = JSON.parse(result.stdout.trim());
    assert.equal(summary.success, true);
    assert.equal(summary.counts.skipped, 1);
    assert.equal(summary.counts.todo, 1);
    assert.equal(isTestRunAccreditable([summary], 1, true, true), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

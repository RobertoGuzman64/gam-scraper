import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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


test("la caché admite las integraciones de preparación auditadas e invalida entradas y dependencias", () => {
  const root = mkdtempSync(join(tmpdir(), "eqt-cache-"));
  try {
    const integration = "testing/integration/preparation/tests/technical.test";
    const editorial = "preparation/shared/editorial/tests/editorial.test";
    const unsafe = "testing/integration/preparation/tests/unsafe.test";
    const outside = "publication/tests/ordinary.test";
    const files = [integration, editorial, unsafe, outside].map((file) => `dist/${file}.js`);
    const write = (file, content) => {
      const path = join(root, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    };
    const createSuite = (file, content) => {
      write(`src/${file}.ts`, content);
      write(`dist/${file}.js`, content);
    };
    createSuite(integration, 'import { value } from "../fixture.js"; import { readFileSync } from "node:fs"; import test from "node:test"; test("censo", () => { readFileSync("data/catalog.json"); value(); });');
    createSuite(editorial, 'import test from "node:test"; test("dominio", () => {});');
    createSuite(unsafe, 'import { writeFileSync } from "node:fs"; import test from "node:test"; test("escritura", () => { writeFileSync("data/catalog.json", "x"); });');
    createSuite(outside, 'import test from "node:test"; test("externa", () => {});');
    write("src/testing/integration/preparation/fixture.ts", "export const value = () => 1;");
    write("dist/testing/integration/preparation/fixture.js", "export const value = () => 1;");
    write("data/catalog.json", '{"version":1}');

    const probe = (seed = false) => {
      const source = `import { fingerprintTestInputs, loadTestResultsCache, saveTestResultsCache } from ${JSON.stringify(new URL("../test-result-cache.mjs", import.meta.url).href)};
        const fingerprints = fingerprintTestInputs(${JSON.stringify(files)});
        const reused = loadTestResultsCache(fingerprints);
        if (${seed}) saveTestResultsCache(fingerprints, new Map([...fingerprints].map(([name, fingerprint]) =>
          [name, { fingerprint, passed: 1, failed: 0, skipped: 0, todo: 0 }])));
        process.stdout.write(JSON.stringify({ eligible: [...fingerprints.keys()].sort(), reused: [...reused.keys()].sort() }));`;
      const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
        cwd: root, encoding: "utf8"
      });
      assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
      return JSON.parse(result.stdout);
    };

    const expected = [files[0], files[1]].sort();
    assert.deepEqual(probe(true), { eligible: expected, reused: [] });
    assert.deepEqual(probe(), { eligible: expected, reused: expected });
    write("data/catalog.json", '{"version":2}');
    assert.deepEqual(probe().reused, [files[1]]);
    write("data/catalog.json", '{"version":1}');
    assert.deepEqual(probe().reused, expected);
    write("src/testing/integration/preparation/fixture.ts", "export const value = () => 2;");
    assert.deepEqual(probe().reused, [files[1]]);
    write("src/testing/integration/preparation/fixture.ts", "export const value = () => 1;");
    write(`dist/${editorial}.js`, 'import test from "node:test"; test("dominio", () => { });');
    assert.deepEqual(probe().reused, [files[0]]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

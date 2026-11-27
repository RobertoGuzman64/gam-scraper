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


test("la caché admite integraciones de preparación sin lecturas externas no acreditadas e invalida dependencias", () => {
  const root = mkdtempSync(join(tmpdir(), "eqt-cache-"));
  try {
    const integration = "testing/integration/preparation/source-technical-unit-consistency.test";
    const editorial = "preparation/shared/editorial/tests/editorial.test";
    const unsafe = "testing/integration/preparation/live-technical-output-consistency.test";
    const outside = "publication/tests/ordinary.test";
    const unaccredited = "testing/integration/preparation/unaccredited.test";
    const files = [integration, editorial, unsafe, outside, unaccredited].map((file) => `dist/${file}.js`);
    const write = (file, content) => {
      const path = join(root, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    };
    const createSuite = (file, content) => {
      write(`src/${file}.ts`, content);
      write(`dist/${file}.js`, content);
    };
    const controlledIntegration = 'import { value } from "./fixture.js"; import test from "node:test"; test("censo", () => { value(); });';
    createSuite(integration, controlledIntegration);
    createSuite(editorial, 'import test from "node:test"; test("dominio", () => {});');
    createSuite(unsafe, 'import { writeFileSync } from "node:fs"; import test from "node:test"; test("escritura", () => { writeFileSync("data/catalog.json", "x"); });');
    createSuite(unaccredited, 'import test from "node:test"; test("no acreditada", () => {});');
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
      const env = { ...process.env, NODE_OPTIONS: "" };
      delete env.NODE_TEST_CONTEXT;
      const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
        cwd: root, encoding: "utf8", env
      });
      assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
      return JSON.parse(result.stdout);
    };

    const expected = [files[0], files[1]].sort();
    assert.deepEqual(probe(true), { eligible: expected, reused: [] });
    assert.deepEqual(probe(), { eligible: expected, reused: expected });
    write("data/catalog.json", '{"version":2}');
    assert.deepEqual(probe().reused, expected);
    write("data/catalog.json", '{"version":1}');
    assert.deepEqual(probe().reused, expected);
    write("src/testing/integration/preparation/fixture.ts", "export const value = () => 2;");
    assert.deepEqual(probe().reused, [files[1]]);
    write("src/testing/integration/preparation/fixture.ts", "export const value = () => 1;");
    write(`dist/${editorial}.js`, 'import test from "node:test"; test("dominio", () => { });');
    assert.deepEqual(probe().reused, [files[0]]);
    write(`dist/${editorial}.js`, 'import test from "node:test"; test("dominio", () => {});');
    createSuite(integration, 'import { value } from "./fixture.js"; import { readFileSync } from "node:fs"; import test from "node:test"; test("censo", () => { readFileSync("data/catalog.json"); value(); });');
    assert.deepEqual(probe(true), { eligible: [files[1]], reused: [files[1]] });
    write("data/catalog.json", '{"version":3}');
    assert.deepEqual(probe(), { eligible: [files[1]], reused: [files[1]] });
    createSuite(integration, controlledIntegration);
    assert.deepEqual(probe(), { eligible: expected, reused: [files[1]] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const withCacheFixture = (action) => {
  const root = mkdtempSync(join(tmpdir(), "eqt-cache-graph-"));
  const file = "dist/preparation/cache.test.js";
  const write = (name, content) => {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  const module = (name, content) => {
    write(`dist/preparation/${name}.js`, content);
    write(`src/preparation/${name}.ts`, content);
  };
  const run = (args, nodeOptions = "") => {
    const env = { ...process.env, NODE_OPTIONS: nodeOptions };
    delete env.NODE_TEST_CONTEXT;
    return spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", env });
  };
  const probe = (seed = false, nodeOptions = "", execArgv = []) => {
    const source = `import { fingerprintTestInputs, loadTestResultsCache, saveTestResultsCache } from ${JSON.stringify(new URL("../test-result-cache.mjs", import.meta.url).href)};
      const fingerprints = fingerprintTestInputs([${JSON.stringify(file)}]);
      const reused = loadTestResultsCache(fingerprints);
      if (${seed}) saveTestResultsCache(fingerprints, new Map([...fingerprints].map(([name, fingerprint]) =>
        [name, { fingerprint, passed: 1, failed: 0, skipped: 0, todo: 0 }])));
      process.stdout.write(JSON.stringify({ eligible: fingerprints.size, reused: reused.size }));`;
    const result = run([...execArgv, "--input-type=module", "--eval", source], nodeOptions);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    return JSON.parse(result.stdout);
  };
  try {
    write("package.json", '{"type":"module"}');
    action({ write, module, probe, execute: (nodeOptions = "") => run(["--test", file], nodeOptions) });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const cacheTestImports = 'import test from "node:test"; import assert from "node:assert/strict"; ';

test("la caché sigue imports y reexportaciones estáticas con comentarios y separadores", () => {
  withCacheFixture(({ module, probe, execute }) => {
    module("cache.test", cacheTestImports + 'import { value } /* ; */ from "./bridge.js"; test("valor", () => assert.equal(value, 1));');
    module("bridge", 'export { value } /* ; */ from "./value.js";');
    module("value", 'export const value = 1;');
    assert.equal(execute().status, 0);
    assert.deepEqual(probe(true), { eligible: 1, reused: 0 });
    assert.deepEqual(probe(), { eligible: 1, reused: 1 });
    module("value", 'export const value = 2;');
    assert.deepEqual(probe(), { eligible: 1, reused: 0 });
    assert.notEqual(execute().status, 0);
  });
});

test("la caché rechaza cargadores con alias y lecturas externas con especificadores escapados", () => {
  withCacheFixture(({ write, module, probe, execute }) => {
    const scenarios = [
      'import { createRequire as load } from "node:module"; const read = load(import.meta.url); export const value = () => read("../../storage/input.json").value;',
      String.raw`import { readFileSync as read } from "node:\x66s"; export const value = () => JSON.parse(read("storage/input.json", "utf8")).value;`
    ];
    module("cache.test", cacheTestImports + 'import { value } from "./reader.js"; test("lectura", () => assert.equal(value(), 1));');
    for (const reader of scenarios) {
      write("storage/input.json", '{"value":1}');
      module("reader", reader);
      assert.equal(execute().status, 0);
      assert.deepEqual(probe(true), { eligible: 0, reused: 0 });
      write("storage/input.json", '{"value":2}');
      assert.deepEqual(probe(), { eligible: 0, reused: 0 });
      assert.notEqual(execute().status, 0);
    }
  });
});

test("las precargas de Node impiden reutilizar resultados aunque su ruta no cambie", () => {
  withCacheFixture(({ write, module, probe, execute }) => {
    module("cache.test", cacheTestImports + 'test("precarga", () => assert.equal(globalThis.fixtureValue, 1));');
    const options = "--require ./preload.cjs";
    write("preload.cjs", 'globalThis.fixtureValue = 1;');
    assert.equal(execute(options).status, 0);
    assert.deepEqual(probe(true, options), { eligible: 0, reused: 0 });
    write("preload.cjs", 'globalThis.fixtureValue = 2;');
    assert.deepEqual(probe(false, options), { eligible: 0, reused: 0 });
    assert.notEqual(execute(options).status, 0);
    module("cache.test", cacheTestImports + 'test("independiente", () => assert.equal(1, 1));');
    assert.deepEqual(probe(true), { eligible: 1, reused: 0 });
    assert.deepEqual(probe(false, options), { eligible: 0, reused: 0 });
    assert.deepEqual(probe(false, "", ["--require", "./preload.cjs"]), { eligible: 0, reused: 0 });
  });
});

test("los grafos ordinarios también rechazan entradas de ejecución no acreditadas", () => {
  withCacheFixture(({ write, module, probe }) => {
    module("cache.test", cacheTestImports + 'import { value } from "./value.js"; test("valor", () => assert.equal(value(), 1));');
    for (const code of [
      'export const value = () => Date.now();',
      'const math = Math; export const value = () => math.random();',
      'import { randomUUID as random } from "node:crypto"; export const value = () => random();',
      'export const value = () => new Date(...[]).getUTCFullYear();',
      'export const value = () => process.getBuiltinModule("fs");',
      'export const value = () => global.process;',
      'export const value = () => import("./other.js");'
    ]) {
      module("value", code);
      assert.deepEqual(probe(), { eligible: 0, reused: 0 }, code);
    }
    module("value", 'export const value = () => new Date().getUTCFullYear();');
    assert.deepEqual(probe(true), { eligible: 1, reused: 0 });
    assert.deepEqual(probe(), { eligible: 1, reused: 1 });
    write("dist/preparation/package.json", '{"type":"commonjs"}');
    assert.deepEqual(probe(), { eligible: 0, reused: 0 });
  });
});

test("los comandos operativos y el formato de dependencias no invalidan grafos independientes", () => {
  withCacheFixture(({ write, module, probe }) => {
    module("cache.test", cacheTestImports + 'test("independiente", () => assert.equal(1, 1));');
    const manifest = { type: "module", scripts: { "catalogo:preparar": "node scripts/tooling.mjs catalogo:preparar", test: "node scripts/testing/run-tests.mjs" } };
    const lock = { lockfileVersion: 3, packages: { "": { version: "1.0.0" } } };
    write("package.json", JSON.stringify(manifest));
    write("package-lock.json", JSON.stringify(lock));
    assert.deepEqual(probe(true), { eligible: 1, reused: 0 });
    const renamed = { ...manifest, scripts: { preparar: "node scripts/tooling.mjs preparar", "publicar:simular": "node scripts/tooling.mjs publicar:simular", test: manifest.scripts.test } };
    write("package.json", JSON.stringify(renamed, null, 2));
    write("package-lock.json", JSON.stringify(lock, null, 2));
    write("README.md", "Nueva ayuda");
    write("docs/operaciones.md", "Nueva documentación");
    assert.deepEqual(probe(), { eligible: 1, reused: 1 });
    for (const changed of [
      { ...renamed, type: "commonjs" },
      { ...renamed, imports: { "#fixture": "./fixture.js" } },
      { ...renamed, dependencies: { fixture: "1.0.0" } },
      { ...renamed, scripts: { ...renamed.scripts, pretest: "node scripts/tooling.mjs pretest" } },
      { ...renamed, scripts: { ...renamed.scripts, test: "node --test" } },
      { ...renamed, scripts: { ...renamed.scripts, prepare: "node scripts/tooling.mjs prepare" } }
    ]) {
      write("package.json", JSON.stringify(changed));
      assert.deepEqual(probe(), { eligible: 1, reused: 0 });
    }
    write("package.json", JSON.stringify(renamed));
    write("package-lock.json", JSON.stringify({ ...lock, packages: { "": { version: "2.0.0" } } }));
    assert.deepEqual(probe(), { eligible: 1, reused: 0 });
    write("package-lock.json", JSON.stringify(lock));
    assert.deepEqual(probe(), { eligible: 1, reused: 1 });
    write("package.json", "{invalid");
    assert.deepEqual(probe(), { eligible: 1, reused: 0 });
  });
});

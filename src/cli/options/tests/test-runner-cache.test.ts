import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawnRunner, withRunner } from "./test-runner-fixture.js";
const addCacheableSuites = (root: string): void => {
  for (const prefix of ["src", "dist"]) for (const name of ["alpha-env", "beta-env"]) {
    const file = join(root, prefix, "preparation", "tests", "cache", `${name}.test.${prefix === "src" ? "ts" : "js"}`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `import { env } from "node:process"; import test from "node:test"; test("${name}", () => { if (env.EQUIPZILLA_FIXTURE === "fail") throw new Error("entorno"); });\n`);
  }
};
const assertNoCacheReuse = (output: string): void => {
  assert.match(output, /PASS \| TESTS \| 4\/4 suites · 4 correctos · 0 fallidos · 0 omitidos/);
  assert.match(output, /caché 0 suites \/ 0 tests/);
};
const assertCacheReuse = (output: string, reused: number, executed: number): void => {
  const total = reused + executed;
  assert.ok(output.includes(`PASS | TESTS | ${total}/${total} suites`));
  assert.match(output, new RegExp(`caché ${reused} suites / ${reused} tests`));
};
const addAuditedCatalogSuites = (root: string): void => {
  for (const name of ["alpha", "beta"]) {
    const sourceDir = join(root, "src", "preparation", "tests", "cache");
    const compiledDir = join(root, "dist", "preparation", "tests", "cache");
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(compiledDir, { recursive: true });
    writeFileSync(join(sourceDir, `${name}-helper.ts`), "export const value = 1;\n");
    writeFileSync(join(compiledDir, `${name}-helper.js`), "export const value = 1;\n");
    writeFileSync(join(sourceDir, `${name}.test.ts`), `import { value } from "./${name}-helper.js";\nexport { value };\n`);
    writeFileSync(join(compiledDir, `${name}.test.js`),
      `import test from "node:test"; import { value } from "./${name}-helper.js"; test("${name}", () => { if (value !== 1) throw new Error("valor modificado"); });\n`);
  }
};
test("npm test reutiliza automáticamente solo suites seguras cuando no cambia ninguna entrada", () => {
  withRunner((root) => {
    addCacheableSuites(root);
    const initial = spawnRunner(root, []);
    assert.equal(initial.status, 0, `${initial.stdout}${initial.stderr}`);
    assertNoCacheReuse(initial.stdout);
    const next = spawnRunner(root, []);
    assert.equal(next.status, 0, `${next.stdout}${next.stderr}`);
    assertCacheReuse(next.stdout, 2, 2);
    assert.match(next.stdout, /4 correctos/);
  });
});
test("un nombre histórico no acredita lecturas externas ni invalida suites independientes", () => {
  withRunner((root) => {
    addCacheableSuites(root);
    for (const prefix of ["src", "dist"]) {
      const file = join(root, prefix, "publication", "tests", `individual-finish.test.${prefix === "src" ? "ts" : "js"}`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, 'import { readFileSync } from "node:fs"; import test from "node:test"; test("histórica", () => { if (readFileSync("input.txt", "utf8") !== "ok") throw new Error("entrada"); });');
    }
    writeFileSync(join(root, "input.txt"), "ok");
    assert.equal(spawnRunner(root, []).status, 0);
    assertCacheReuse(spawnRunner(root, []).stdout, 2, 3);
    writeFileSync(join(root, "src", "prueba.test.ts"), "export const version = 2;\n");
    assertCacheReuse(spawnRunner(root, []).stdout, 2, 3);
    writeFileSync(join(root, "input.txt"), "bad");
    const failed = spawnRunner(root, []);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stdout, /caché 2 suites \/ 2 tests/);
  });
});
test("mediciones, concurrencia personalizada y CI ejecutan toda la batería", () => {
  withRunner((root) => {
    addCacheableSuites(root);
    assert.equal(spawnRunner(root, []).status, 0);
    const cached = spawnRunner(root, []);
    assertCacheReuse(cached.stdout, 2, 2);
    const reportPath = join(root, "medicion.json");
    const measured = spawnRunner(root, ["--medicion", reportPath]);
    assert.equal(measured.status, 0, `${measured.stdout}${measured.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportPath, "utf8"));
    assert.ok(report && typeof report === "object" && "resumen" in report &&
      report.resumen && typeof report.resumen === "object" && "cache" in report.resumen);
    assert.deepEqual(report.resumen.cache, { reutilizados: 0, ejecutados: 4, tests_reutilizados: 0 });
    const manual = spawnRunner(root, ["--concurrencia", "2"]);
    assert.equal(manual.status, 0, `${manual.stdout}${manual.stderr}`);
    assert.match(manual.stdout, /caché 0 suites \/ 0 tests/);
    const ci = spawnRunner(root, [], { CI: "true" });
    assert.equal(ci.status, 0, `${ci.stdout}${ci.stderr}`);
    assert.match(ci.stdout, /caché 0 suites \/ 0 tests/);
    const forced = spawnRunner(root, [], { EQUIPZILLA_TEST_CACHE: "0" });
    assert.equal(forced.status, 0, `${forced.stdout}${forced.stderr}`);
    assert.match(forced.stdout, /caché 0 suites \/ 0 tests/);
  });
});
test("caché corrupta y resultados fallidos nunca acreditan tests", () => {
  withRunner((root) => {
    addCacheableSuites(root);
    assert.equal(spawnRunner(root, []).status, 0);
    const cachePath = join(root, "dist", ".test-results-cache.json");
    const cache: { version: number; results: Record<string, unknown> } = JSON.parse(readFileSync(cachePath, "utf8"));
    cache.results["dist/preparation/tests/cache/alpha-env.test.js"] = null;
    cache.results["dist/prueba.test.js"] = { passed: 99, failed: 0, skipped: 0, todo: 0 };
    writeFileSync(cachePath, JSON.stringify(cache));
    const partial = spawnRunner(root, []);
    assert.equal(partial.status, 0, `${partial.stdout}${partial.stderr}`);
    assertCacheReuse(partial.stdout, 1, 3);
    assert.match(partial.stdout, /4 correctos/);
    writeFileSync(cachePath, JSON.stringify({ ...cache, version: -1 }));
    assertNoCacheReuse(spawnRunner(root, []).stdout);
    writeFileSync(cachePath, "not valid JSON");
    const corrupted = spawnRunner(root, []);
    assert.equal(corrupted.status, 0, `${corrupted.stdout}${corrupted.stderr}`);
    assertNoCacheReuse(corrupted.stdout);
    const script = join(root, "scripts", "inspection", "tests", "prueba.test.mjs");
    writeFileSync(script, 'import test from "node:test"; test("falla", () => { throw new Error("fallo"); });\n');
    const failed = spawnRunner(root, []);
    assert.equal(failed.status, 1, `${failed.stdout}${failed.stderr}`);
    assert.match(failed.stdout, /1 fallidos/);
    writeFileSync(script, 'import test from "node:test"; test("prueba MJS", () => {});\n');
    const following = spawnRunner(root, []);
    assert.equal(following.status, 0, `${following.stdout}${following.stderr}`);
    assertNoCacheReuse(following.stdout);
  });
});
test("la caché automática abarca suites de preparación auditadas sin nuevos comandos", () => {
  withRunner((root) => {
    addAuditedCatalogSuites(root);
    const first = spawnRunner(root, []);
    assert.equal(first.status, 0, `${first.stdout}${first.stderr}`);
    assertNoCacheReuse(first.stdout);
    const second = spawnRunner(root, []);
    assert.equal(second.status, 0, `${second.stdout}${second.stderr}`);
    assertCacheReuse(second.stdout, 2, 2);
    assert.match(second.stdout, /4 correctos/);
  });
});
test("los identificadores de sesión solo se normalizan en grafos independientes del entorno", () => {
  withRunner((root) => {
    addAuditedCatalogSuites(root);
    addCacheableSuites(root);
    const sourceDir = join(root, "src", "preparation", "tests", "cache");
    const compiledDir = join(root, "dist", "preparation", "tests", "cache");
    const helper = 'import { env } from "node:process"; export const session = env.WT_SESSION;\n';
    const bridge = 'export { session } from "./session-helper.js";\n';
    const suite = 'import test from "node:test"; import { session } from "./session-bridge.js"; test("sesión", () => { if (session === "fail") throw new Error("sesión inválida"); });\n';
    const modules: readonly (readonly [string, string])[] = [["session-helper", helper], ["session-bridge", bridge], ["session.test", suite]];
    for (const [name, content] of modules) {
      writeFileSync(join(sourceDir, `${name}.ts`), content);
      writeFileSync(join(compiledDir, `${name}.js`), content);
    }
    const firstEnv = { WT_SESSION: "first", WT_PROFILE_ID: "profile-a", VSCODE_PID: "111",
      VSCODE_IPC_HOOK_CLI: "ipc-a", SHLVL: "1", _: "shell-a", NODE_OPTIONS: "", EQUIPZILLA_TEST_CONTEXT: "known" };
    const secondEnv = { ...firstEnv, WT_SESSION: "second", WT_PROFILE_ID: "profile-b", VSCODE_PID: "222",
      VSCODE_IPC_HOOK_CLI: "ipc-b", SHLVL: "2", _: "shell-b" };
    const first = spawnRunner(root, [], firstEnv);
    assert.equal(first.status, 0, `${first.stdout}${first.stderr}`);
    assertCacheReuse(first.stdout, 0, 7);
    const warm = spawnRunner(root, [], firstEnv);
    assert.equal(warm.status, 0, `${warm.stdout}${warm.stderr}`);
    assertCacheReuse(warm.stdout, 5, 2);
    const changed = spawnRunner(root, [], secondEnv);
    assert.equal(changed.status, 0, `${changed.stdout}${changed.stderr}`);
    assertCacheReuse(changed.stdout, 2, 5);
    const failed = spawnRunner(root, [], { ...secondEnv, WT_SESSION: "fail" });
    assert.notEqual(failed.status, 0);
    assert.match(failed.stdout + failed.stderr, /FAIL \| sesión .*session\.test\.js/);
    assert.match(failed.stdout, /7\/7 suites · 6 correctos · 1 fallidos/);
    assert.match(failed.stdout, /caché 2 suites \/ 2 tests/);
    const recovered = spawnRunner(root, [], secondEnv);
    assert.equal(recovered.status, 0, `${recovered.stdout}${recovered.stderr}`);
    assertCacheReuse(recovered.stdout, 0, 7);
    const unknown = spawnRunner(root, [], { ...secondEnv, EQUIPZILLA_TEST_CONTEXT: "unknown" });
    assert.equal(unknown.status, 0, `${unknown.stdout}${unknown.stderr}`);
    assertCacheReuse(unknown.stdout, 0, 7);
  });
});
test("la configuración de Node y las sesiones vacías conservan la invalidación conservadora", () => {
  withRunner((root) => {
    addAuditedCatalogSuites(root);
    const initialEnv = { WT_SESSION: "first", NODE_OPTIONS: "--no-warnings" };
    const initial = spawnRunner(root, [], initialEnv);
    assert.equal(initial.status, 0, `${initial.stdout}${initial.stderr}`);
    const warm = spawnRunner(root, [], initialEnv);
    assert.equal(warm.status, 0, `${warm.stdout}${warm.stderr}`);
    assertCacheReuse(warm.stdout, 2, 2);
    const changed = spawnRunner(root, [], { ...initialEnv, WT_SESSION: "second" });
    assert.equal(changed.status, 0, `${changed.stdout}${changed.stderr}`);
    assertNoCacheReuse(changed.stdout);
    const plain = { WT_SESSION: "first", NODE_OPTIONS: "" };
    assert.equal(spawnRunner(root, [], plain).status, 0);
    const empty = spawnRunner(root, [], { ...plain, WT_SESSION: "" });
    assert.equal(empty.status, 0, `${empty.stdout}${empty.stderr}`);
    assertNoCacheReuse(empty.stdout);
  });
});
test("el cambio de una dependencia invalida solo su suite, no las demás", () => {
  withRunner((root) => {
    addAuditedCatalogSuites(root);
    assert.equal(spawnRunner(root, []).status, 0);
    assert.equal(spawnRunner(root, []).status, 0);
    const source = join(root, "src", "preparation", "tests", "cache", "alpha-helper.ts");
    const compiled = join(root, "dist", "preparation", "tests", "cache", "alpha-helper.js");
    writeFileSync(source, "export const value =  1;\n");
    writeFileSync(compiled, "export const value =  1;\n");
    const changed = spawnRunner(root, []);
    assert.equal(changed.status, 0, `${changed.stdout}${changed.stderr}`);
    assertCacheReuse(changed.stdout, 1, 3);
    assert.equal(spawnRunner(root, []).status, 0);
    const unrelated = join(root, "src", "unrelated.ts");
    writeFileSync(unrelated, "export const unaffected = true;\n");
    const independent = spawnRunner(root, []);
    assert.equal(independent.status, 0, `${independent.stdout}${independent.stderr}`);
    assertCacheReuse(independent.stdout, 2, 2);
  });
});
test("las lecturas externas no acreditadas nunca reutilizan éxitos anteriores", () => {
  withRunner((root) => {
    addAuditedCatalogSuites(root);
    const sourceDir = join(root, "src", "preparation", "tests", "cache");
    const compiledDir = join(root, "dist", "preparation", "tests", "cache");
    mkdirSync(join(root, "storage"));
    const input = join(root, "storage", "input.txt");
    writeFileSync(input, "valid");
    const reader = 'import { readFileSync } from "node:fs"; export const value = () => readFileSync("storage/input.txt", "utf8");';
    writeFileSync(join(sourceDir, "reader.ts"), reader);
    writeFileSync(join(compiledDir, "reader.js"), reader);
    const suite = 'import test from "node:test"; import { value } from "./reader.js"; test("external", () => { if (value() !== "valid") throw new Error("datos inválidos"); });';
    writeFileSync(join(sourceDir, "external.test.ts"), suite);
    writeFileSync(join(compiledDir, "external.test.js"), suite);
    writeFileSync(join(sourceDir, "unsafe.test.ts"), 'import { writeFileSync } from "node:fs"; export { writeFileSync };');
    writeFileSync(join(compiledDir, "unsafe.test.js"), 'import test from "node:test"; test("unsafe", () => {});');
    assert.equal(spawnRunner(root, []).status, 0);
    const warm = spawnRunner(root, []);
    assert.equal(warm.status, 0, `${warm.stdout}${warm.stderr}`);
    assertCacheReuse(warm.stdout, 2, 4);
    writeFileSync(input, "invalid");
    const failed = spawnRunner(root, []);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stdout, /caché 2 suites \/ 2 tests/);
    assert.match(failed.stdout, /FAIL \| external/);
  });
});
test("importaciones dinámicas y módulos externos quedan fuera de la caché", () => {
  withRunner((root) => {
    addAuditedCatalogSuites(root);
    const sourceDir = join(root, "src", "preparation", "tests", "cache");
    const compiledDir = join(root, "dist", "preparation", "tests", "cache");
    writeFileSync(join(sourceDir, "dynamic.test.ts"), "export {};\n");
    writeFileSync(join(compiledDir, "dynamic.test.js"),
      'import test from "node:test"; test("dynamic", async () => { await import("./alpha-helper.js"); });\n');
    writeFileSync(join(sourceDir, "external.test.ts"), "export {};\n");
    const packageDir = join(root, "node_modules", "external-test-module");
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, "package.json"), '{"name":"external-test-module","type":"module","exports":"./index.js"}');
    writeFileSync(join(packageDir, "index.js"), "export const value = 1;\n");
    writeFileSync(join(compiledDir, "external.test.js"),
      'import test from "node:test"; import { value } from "external-test-module"; test("external", () => { if (value !== 1) throw new Error("valor"); });\n');
    assert.equal(spawnRunner(root, []).status, 0);
    const again = spawnRunner(root, []);
    assert.equal(again.status, 0, `${again.stdout}${again.stderr}`);
    assertCacheReuse(again.stdout, 2, 4);
  });
});
test("el perfil caliente conserva la reutilización real y mide solo las suites ejecutadas", () => {
  withRunner((root) => {
    addCacheableSuites(root);
    const first = spawnRunner(root, []);
    assert.equal(first.status, 0, `${first.stdout}${first.stderr}`);
    const reportPath = join(root, "perfil-caliente.json");
    const warm = spawnRunner(root, ["--medicion-cache", reportPath]);
    assert.equal(warm.status, 0, `${warm.stdout}${warm.stderr}`);
    assertCacheReuse(warm.stdout, 2, 2);
    const report: unknown = JSON.parse(readFileSync(reportPath, "utf8"));
    assert.ok(report && typeof report === "object" && "resumen" in report && report.resumen &&
      typeof report.resumen === "object" && "cache" in report.resumen && "correctos" in report.resumen &&
      "archivos" in report && Array.isArray(report.archivos));
    assert.deepEqual(report.resumen.cache, { reutilizados: 2, ejecutados: 2, tests_reutilizados: 2 });
    assert.equal(report.archivos.length, 2);
    assert.equal(report.resumen.correctos, 4);
    const conflicting = spawnRunner(root, ["--medicion", reportPath, "--medicion-cache", reportPath]);
    assert.notEqual(conflicting.status, 0);
    assert.match(conflicting.stderr, /No se combinan --medicion y --medicion-cache/);
  });
});
test("cambiar el ejecutor del runner invalida las suites cacheadas", () => {
  withRunner((root) => {
    addCacheableSuites(root);
    const initial = spawnRunner(root, []);
    assert.equal(initial.status, 0, `${initial.stdout}${initial.stderr}`);
    const warm = spawnRunner(root, []);
    assert.equal(warm.status, 0, `${warm.stdout}${warm.stderr}`);
    assertCacheReuse(warm.stdout, 2, 2);
    const module = join(root, "scripts", "testing", "test-runner-execution.mjs");
    writeFileSync(module, `${readFileSync(module, "utf8")}\n`);
    const invalidated = spawnRunner(root, []);
    assert.equal(invalidated.status, 0, `${invalidated.stdout}${invalidated.stderr}`);
    assertNoCacheReuse(invalidated.stdout);
    const warmedAgain = spawnRunner(root, []);
    assert.equal(warmedAgain.status, 0, `${warmedAgain.stdout}${warmedAgain.stderr}`);
    assertCacheReuse(warmedAgain.stdout, 2, 2);
    const workerModule = join(root, "scripts", "testing", "test-runner-worker.mjs");
    writeFileSync(workerModule, `${readFileSync(workerModule, "utf8")}\n`);
    const workerChanged = spawnRunner(root, []);
    assert.equal(workerChanged.status, 0, `${workerChanged.stdout}${workerChanged.stderr}`);
    assertNoCacheReuse(workerChanged.stdout);
  });
});
const addNewPureSuites = (root: string): void => {
  for (const prefix of ["src", "dist"]) {
    const extension = prefix === "src" ? "ts" : "js";
    const directory = join(root, prefix, "catalog", "interventions", "tests");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, `value.${extension}`), "export const value = 1;\n");
    writeFileSync(join(directory, `helper.${extension}`), 'export { value } from "./value.js";\n');
    writeFileSync(join(directory, `comparison.test.${extension}`),
      'import test from "node:test"; import assert from "node:assert/strict"; import { value } from "./helper.js"; test("comparison", () => assert.equal(value, 1));\n');
    for (const name of ["record", "not-audited"]) {
      writeFileSync(join(directory, `${name}.test.${extension}`),
        `import test from "node:test"; test("${name}", () => {});\n`);
    }
  }
};
const changeNewPureDependency = (root: string, content: string): void => {
  for (const prefix of ["src", "dist"]) {
    const extension = prefix === "src" ? "ts" : "js";
    writeFileSync(join(root, prefix, "catalog", "interventions", "tests", `value.${extension}`), content);
  }
};
test("las nuevas admisiones puras reutilizan resultados sin ampliar automáticamente su familia", () => {
  withRunner((root) => {
    addNewPureSuites(root);
    const first = spawnRunner(root, []);
    assert.equal(first.status, 0, `${first.stdout}${first.stderr}`);
    assertCacheReuse(first.stdout, 0, 5);
    const warm = spawnRunner(root, []);
    assert.equal(warm.status, 0, `${warm.stdout}${warm.stderr}`);
    assertCacheReuse(warm.stdout, 2, 3);
    changeNewPureDependency(root, "export const value = 2;\n");
    const failed = spawnRunner(root, []);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stdout + failed.stderr, /FAIL \| comparison .*comparison\.test\.js/);
    assert.match(failed.stdout, /caché 1 suites \/ 1 tests/);
    changeNewPureDependency(root, "export const value = 1;\n");
    const recovered = spawnRunner(root, []);
    assert.equal(recovered.status, 0, `${recovered.stdout}${recovered.stderr}`);
    assertCacheReuse(recovered.stdout, 0, 5);
  });
});
test("una nueva admisión pura deja de cachearse si su grafo incorpora entradas no acreditadas", () => {
  withRunner((root) => {
    addNewPureSuites(root);
    assert.equal(spawnRunner(root, []).status, 0);
    for (const content of [
      "export const value = new Date().getUTCFullYear() > 2000 ? 1 : 0;\n",
      'import { existsSync } from "node:fs"; export const value = existsSync("package.json") ? 1 : 0;\n',
      'export const value = process.env.WT_SESSION === "never" ? 0 : 1;\n',
      "export const value = Math.random() >= 0 ? 1 : 0;\n"
    ]) {
      changeNewPureDependency(root, content);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = spawnRunner(root, []);
        assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
        assertCacheReuse(result.stdout, 1, 4);
      }
    }
    changeNewPureDependency(root, "export const value = 1;\n");
    const restored = spawnRunner(root, []);
    assert.equal(restored.status, 0, `${restored.stdout}${restored.stderr}`);
    assertCacheReuse(restored.stdout, 1, 4);
    const warm = spawnRunner(root, []);
    assert.equal(warm.status, 0, `${warm.stdout}${warm.stderr}`);
    assertCacheReuse(warm.stdout, 2, 3);
  });
});

test("la admisión por año UTC no autoriza otras dependencias del reloj", () => {
  withRunner((root) => {
    const set = (expression: string) => {
      for (const prefix of ["src", "dist"]) {
        const file = join(root, prefix, "catalog", "normalization", "tests", `spec-angular-configuration.test.${prefix === "src" ? "ts" : "js"}`);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, `import test from "node:test"; test("reloj", () => { if (!(${expression})) throw new Error("reloj"); });`);
      }
    };
    set("new Date().getUTCFullYear() > 2000");
    assert.equal(spawnRunner(root, []).status, 0);
    assertCacheReuse(spawnRunner(root, []).stdout, 1, 2);
    set("Date.now() > 0");
    assertCacheReuse(spawnRunner(root, []).stdout, 0, 3);
    assertCacheReuse(spawnRunner(root, []).stdout, 0, 3);
  });
});
const addScopedDataSuites = (root: string): void => {
  const project = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const compilerDirectory = join(root, "node_modules", "typescript");
  mkdirSync(compilerDirectory, { recursive: true });
  copyFileSync(createRequire(import.meta.url).resolve("typescript"), join(compilerDirectory, "index.js"));
  for (const prefix of ["src", "dist"]) {
    const extension = prefix === "src" ? "ts" : "js";
    for (const module of ["infrastructure/filesystem/editorial-knowledge", "infrastructure/filesystem/legacy-export/import-catalog-loader",
      "preparation/editorial/core/editorial-knowledge", "preparation/editorial/core/editorial-families"]) {
      const relative = join(prefix, `${module}.${extension}`);
      mkdirSync(dirname(join(root, relative)), { recursive: true });
      copyFileSync(join(project, relative), join(root, relative));
    }
    const suiteDirectory = join(root, prefix, "preparation", "tests");
    mkdirSync(suiteDirectory, { recursive: true });
    writeFileSync(join(suiteDirectory, `static-data.${extension}`), 'const label = "assets-global"; export const values = [label, "this stacker"];\n');
    const knowledge = 'import { loadEditorialKnowledge } from "../../infrastructure/filesystem/editorial-knowledge.js"; import "./static-data.js";';
    const metadata = 'import { loadImportCatalog } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";';
    for (const [name, imports, body] of [
      ["knowledge", knowledge, 'loadEditorialKnowledge();'],
      ["metadata", metadata, 'await loadImportCatalog();'],
      ["combined", `${knowledge} ${metadata}`, 'loadEditorialKnowledge(); await loadImportCatalog();']
    ] as const) {
      writeFileSync(join(suiteDirectory, `${name}.test.${extension}`),
        `import test from "node:test"; ${imports} test("${name}", async () => { ${body} });\n`);
    }
  }
  const data = join(root, "data");
  const knowledge = join(data, "editorial", "knowledge");
  mkdirSync(knowledge, { recursive: true });
  for (const name of ["verified-units", "model-consensus", "manufacturer-models", "model-technical-references"]) {
    writeFileSync(join(knowledge, `${name}.json`), '{"version":1,"entries":[]}');
  }
  writeFileSync(join(knowledge, "family-guidance.json"), '{"version":1,"entries":{}}');
  for (const directory of [join(data, "category"), join(data, "import"), join(root, "docs"), join(root, "catalogs")]) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(join(data, "category", "categorySell-flat.json"), '[]');
  writeFileSync(join(data, "import", "attributeCatalog.json"), '{"attributes":[],"relations":[]}');
};

test("los lectores de datos acreditados conservan huellas independientes y ejecutan ante fallos relevantes", () => {
  withRunner((root) => {
    addScopedDataSuites(root);
    const run = () => {
      const result = spawnRunner(root, [], { NODE_OPTIONS: "" });
      assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
      return result.stdout;
    };
    assertCacheReuse(run(), 0, 5);
    assertCacheReuse(run(), 3, 2);
    writeFileSync(join(root, "docs", "notes.md"), "Cambio independiente");
    writeFileSync(join(root, "catalogs", "fixture.json"), "{}");
    assertCacheReuse(run(), 3, 2);
    writeFileSync(join(root, "data", "editorial", "knowledge", "verified-units.json"), '{"version":1,"entries":[]}\n');
    assertCacheReuse(run(), 1, 4);
    writeFileSync(join(root, "data", "category", "categorySell-flat.json"), '[]\n');
    assertCacheReuse(run(), 1, 4);
    const metadata = join(root, "data", "import", "attributeCatalog.json");
    writeFileSync(metadata, '{}');
    const failed = spawnRunner(root, [], { NODE_OPTIONS: "" });
    assert.notEqual(failed.status, 0);
    assert.match(failed.stdout, /caché 1 suites \/ 1 tests/);
    assert.match(failed.stdout, /FAIL \| combined/);
    assert.match(failed.stdout, /FAIL \| metadata/);
    assert.match(failed.stdout, /2 fallidos/);
    writeFileSync(metadata, '{"attributes":[],"relations":[]}');
    assertCacheReuse(run(), 0, 5);
    assertCacheReuse(run(), 3, 2);
    const reader = join(root, "src", "infrastructure", "filesystem", "legacy-export", "import-catalog-loader.ts");
    writeFileSync(reader, `${readFileSync(reader, "utf8")}\n`);
    assertCacheReuse(run(), 1, 4);
    assertCacheReuse(run(), 1, 4);
    writeFileSync(join(root, "docs", "notes.md"), "Cambio con lector no acreditado");
    assertCacheReuse(run(), 1, 4);
    const compiled = join(root, "dist", "infrastructure", "filesystem", "editorial-knowledge.js");
    writeFileSync(compiled, `${readFileSync(compiled, "utf8")}\n`);
    assertCacheReuse(run(), 0, 5);
    assertCacheReuse(run(), 0, 5);
    writeFileSync(join(root, "docs", "notes.md"), "Cambio con compilado distinto");
    assertCacheReuse(run(), 0, 5);
  });
});

test("un fixture temporal acreditado se reutiliza solo mientras su grafo conserve la acreditación", () => {
  withRunner((root) => {
    const project = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
    for (const prefix of ["src", "dist"]) for (const module of ["catalog/diagnostics/findings/finding-recognitions",
      "infrastructure/filesystem/catalog/finding-recognition-store", "infrastructure/filesystem/catalog/tests/finding-recognition-store.test"]) {
      const file = join(prefix, `${module}.${prefix === "src" ? "ts" : "js"}`);
      mkdirSync(dirname(join(root, file)), { recursive: true });
      copyFileSync(join(project, file), join(root, file));
    }
    const compilerDirectory = join(root, "node_modules", "typescript");
    mkdirSync(compilerDirectory, { recursive: true });
    copyFileSync(createRequire(import.meta.url).resolve("typescript"), join(compilerDirectory, "index.js"));
    const env = { NODE_OPTIONS: "" };
    assert.equal(spawnRunner(root, [], env).status, 0);
    const warm = spawnRunner(root, [], env);
    assert.equal(warm.status, 0, `${warm.stdout}${warm.stderr}`);
    assert.match(warm.stdout, /caché 1 suites \/ 5 tests/);
    const module = join(root, "dist", "infrastructure", "filesystem", "catalog", "finding-recognition-store.js");
    writeFileSync(module, `${readFileSync(module, "utf8")}\n// Formato independiente del compilador.\n`);
    assert.match(spawnRunner(root, [], env).stdout, /caché 0 suites \/ 0 tests/);
    assert.match(spawnRunner(root, [], env).stdout, /caché 1 suites \/ 5 tests/);
    writeFileSync(module, `${readFileSync(module, "utf8")}\nthrow new Error("dependencia modificada");\n`);
    const failed = spawnRunner(root, [], env);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stdout, /caché 0 suites \/ 0 tests/);
  });
});

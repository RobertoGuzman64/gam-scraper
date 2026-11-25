import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { spawnRunner, withRunner } from "./test-runner-fixture.js";

const addCacheableSuites = (root: string): void => {
  for (const name of ["individual-finish", "individual-accreditation-session"]) {
    const source = join(root, "src", "publication", "tests", `${name}.test.ts`);
    const compiled = join(root, "dist", "publication", "tests", `${name}.test.js`);
    mkdirSync(dirname(source), { recursive: true });
    mkdirSync(dirname(compiled), { recursive: true });
    writeFileSync(source, 'export {};\n');
    writeFileSync(compiled, `import { appendFileSync } from "node:fs"; import test from "node:test"; test("${name}", () => appendFileSync("ejecuciones-cache.txt", "${name}\\n"));\n`);
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
    const first = readFileSync(join(root, "ejecuciones-cache.txt"), "utf8");
    assert.equal(first.trim().split("\n").length, 2);
    const next = spawnRunner(root, []);
    assert.equal(next.status, 0, `${next.stdout}${next.stderr}`);
    assertCacheReuse(next.stdout, 2, 2);
    assert.match(next.stdout, /4 correctos/);
    assert.equal(readFileSync(join(root, "ejecuciones-cache.txt"), "utf8"), first);
  });
});

test("las suites legadas conservan invalidación global por código, datos y entorno", () => {
  withRunner((root) => {
    addCacheableSuites(root);
    assert.equal(spawnRunner(root, []).status, 0);
    assert.equal(spawnRunner(root, []).status, 0);
    writeFileSync(join(root, "src", "prueba.test.ts"), "export const version = 2;\n");
    const sourceChanged = spawnRunner(root, []);
    assert.equal(sourceChanged.status, 0, `${sourceChanged.stdout}${sourceChanged.stderr}`);
    assertNoCacheReuse(sourceChanged.stdout);
    assert.equal(spawnRunner(root, []).status, 0);
    mkdirSync(join(root, "catalogs"));
    writeFileSync(join(root, "catalogs", "fixture.json"), '{"valor":1}');
    const fixtureChanged = spawnRunner(root, []);
    assert.equal(fixtureChanged.status, 0, `${fixtureChanged.stdout}${fixtureChanged.stderr}`);
    assertNoCacheReuse(fixtureChanged.stdout);
    assert.equal(spawnRunner(root, []).status, 0);
    const environmentChanged = spawnRunner(root, [], { EQUIPZILLA_TEST_CONTEXT: "otro" });
    assert.equal(environmentChanged.status, 0, `${environmentChanged.stdout}${environmentChanged.stderr}`);
    assertNoCacheReuse(environmentChanged.stdout);
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
    assert.equal(readFileSync(join(root, "ejecuciones-cache.txt"), "utf8").trim().split("\n").length, 10);
  });
});

test("caché corrupta y resultados fallidos nunca acreditan tests", () => {
  withRunner((root) => {
    addCacheableSuites(root);
    assert.equal(spawnRunner(root, []).status, 0);
    writeFileSync(join(root, "dist", ".test-results-cache.json"), "not valid JSON");
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

test("los datos externos solo invalidan suites que dependen de ellos", () => {
  withRunner((root) => {
    addAuditedCatalogSuites(root);
    const sourceDir = join(root, "src", "preparation", "tests", "cache");
    const compiledDir = join(root, "dist", "preparation", "tests", "cache");
    writeFileSync(join(sourceDir, "unsafe.test.ts"),
      'import { writeFileSync } from "node:fs";\nexport { writeFileSync };\n');
    writeFileSync(join(compiledDir, "unsafe.test.js"),
      'import test from "node:test"; test("unsafe", () => {});\n');
    mkdirSync(join(root, "catalogs"));
    writeFileSync(join(root, "catalogs", "nuevo.json"), '{"revision":1}');
    writeFileSync(join(sourceDir, "file-reader.ts"),
      'import { readFileSync } from "node:fs";\nexport const readCatalog = (): string => readFileSync("catalogs/nuevo.json", "utf8");\n');
    writeFileSync(join(compiledDir, "file-reader.js"),
      'import { readFileSync } from "node:fs";\nexport const readCatalog = () => readFileSync("catalogs/nuevo.json", "utf8");\n');
    writeFileSync(join(sourceDir, "external.test.ts"),
      'import { readCatalog } from "./file-reader.js";\nexport { readCatalog };\n');
    writeFileSync(join(compiledDir, "external.test.js"),
      'import { readCatalog } from "./file-reader.js"; import test from "node:test"; test("external", () => { if (!readCatalog().includes("revision")) throw new Error("sin datos"); });\n');
    assert.equal(spawnRunner(root, []).status, 0);
    const second = spawnRunner(root, []);
    assert.equal(second.status, 0, `${second.stdout}${second.stderr}`);
    assertCacheReuse(second.stdout, 3, 3);
    writeFileSync(join(root, "catalogs", "nuevo.json"), '{"revision":2}');
    const changed = spawnRunner(root, []);
    assert.equal(changed.status, 0, `${changed.stdout}${changed.stderr}`);
    assertCacheReuse(changed.stdout, 2, 4);
    const unrelated = join(root, "docs");
    mkdirSync(unrelated);
    writeFileSync(join(unrelated, "notes.md"), "Actualización editorial");
    const docsChanged = spawnRunner(root, []);
    assert.equal(docsChanged.status, 0, `${docsChanged.stdout}${docsChanged.stderr}`);
    assertCacheReuse(docsChanged.stdout, 2, 4);
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
    assert.equal(readFileSync(join(root, "ejecuciones-cache.txt"), "utf8").trim().split("\n").length, 2);
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

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

const spawnRunner = (root: string, args: readonly string[], overrides: NodeJS.ProcessEnv = {}) => {
  const env: NodeJS.ProcessEnv = { ...process.env, CI: "false", ...overrides };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [join(root, "scripts", "run-tests.mjs"), ...args],
    { cwd: root, encoding: "utf8", env });
};

const withRunner = (action: (root: string) => void): void => {
  const root = mkdtempSync(join(tmpdir(), "equipzilla-runner-"));
  try {
    mkdirSync(join(root, "scripts", "inspection", "tests"), { recursive: true });
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "dist"));
    copyFileSync(join(projectRoot, "scripts", "run-tests.mjs"), join(root, "scripts", "run-tests.mjs"));
    copyFileSync(join(projectRoot, "scripts", "terminal.mjs"), join(root, "scripts", "terminal.mjs"));
    copyFileSync(join(projectRoot, "scripts", "test-performance.mjs"), join(root, "scripts", "test-performance.mjs"));
    copyFileSync(join(projectRoot, "scripts", "test-result-cache.mjs"), join(root, "scripts", "test-result-cache.mjs"));
    writeFileSync(join(root, "package.json"), '{"type":"module"}');
    writeFileSync(join(root, "src", "prueba.test.ts"), "export {};\n");
    writeFileSync(join(root, "dist", "prueba.test.js"),
      'import test from "node:test"; test("prueba TypeScript", () => {});\n');
    writeFileSync(join(root, "scripts", "inspection", "tests", "prueba.test.mjs"),
      'import test from "node:test"; test("prueba MJS", () => {});\n');
    action(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test("el runner incluye pruebas TypeScript y MJS en un único informe", () => {
  withRunner((root) => {
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--concurrencia=2", "--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(typeof report === "object" && report !== null && "resumen" in report);
    const summary = report.resumen;
    assert.ok(typeof summary === "object" && summary !== null && "archivos" in summary &&
      "correctos" in summary && "fallidos" in summary && "omitidos" in summary);
    assert.equal(summary.archivos, 2);
    assert.equal(summary.correctos, 2);
    assert.equal(summary.fallidos, 0);
    assert.equal(summary.omitidos, 0);
    assert.ok("archivos" in report && Array.isArray(report.archivos));
    assert.equal(report.archivos.length, 2);
    for (const file of report.archivos) {
      assert.ok(typeof file === "object" && file !== null && "inicio_ms" in file &&
        "fin_ms" in file && "tiempo_ms" in file);
      assert.equal(typeof file.inicio_ms, "number");
      assert.equal(typeof file.fin_ms, "number");
      assert.equal(typeof file.tiempo_ms, "number");
      assert.ok("informe_recibido_ms" in file && typeof file.informe_recibido_ms === "number");
      assert.ok("retraso_informe_ms" in file && typeof file.retraso_informe_ms === "number");
      assert.ok(Math.abs(file.fin_ms - file.inicio_ms - file.tiempo_ms) < 0.01);
      assert.ok(file.informe_recibido_ms + 10 >= file.fin_ms);
    }
    assert.ok("diagnostico" in report && typeof report.diagnostico === "object" &&
      report.diagnostico !== null && "cota_inferior_ideal_ms" in report.diagnostico);
    assert.equal(typeof report.diagnostico.cota_inferior_ideal_ms, "number");
    assert.ok("ultimo_fin_estimado_ms" in report.diagnostico &&
      typeof report.diagnostico.ultimo_fin_estimado_ms === "number");
  });
});

test("el runner distribuye las pruebas intensivas sin perder resultados ni superar la concurrencia", () => {
  withRunner((root) => {
    const heavy = ["individual-finish", "individual-accreditation-session"];
    for (const name of heavy) {
      const source = join(root, "src", "pipeline", "publication", "tests", `${name}.test.ts`);
      const compiled = join(root, "dist", "pipeline", "publication", "tests", `${name}.test.js`);
      mkdirSync(dirname(source), { recursive: true });
      mkdirSync(dirname(compiled), { recursive: true });
      writeFileSync(source, "export {};\n");
      writeFileSync(compiled, `import test from "node:test"; test("${name}", () => {});\n`);
    }
    for (let index = 0; index < 18; index += 1) {
      const source = join(root, "src", `ligera-${index}.test.ts`);
      const compiled = join(root, "dist", `ligera-${index}.test.js`);
      writeFileSync(source, "export {};\n");
      writeFileSync(compiled, `import test from "node:test"; test("ligera-${index}", () => {});\n`);
    }
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--concurrencia=12", "--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(report !== null && typeof report === "object" &&
      "resumen" in report && "distribucion" in report && Array.isArray(report.distribucion));
    assert.ok(report.resumen !== null && typeof report.resumen === "object" &&
      "archivos" in report.resumen && "correctos" in report.resumen && "fallidos" in report.resumen);
    assert.equal(report.resumen.archivos, 22);
    assert.equal(report.resumen.correctos, 22);
    assert.equal(report.resumen.fallidos, 0);
    assert.equal(report.distribucion.length, 2);
    assert.ok(report.distribucion.every((lane) => lane !== null && typeof lane === "object" &&
      "archivos" in lane && "concurrencia" in lane && typeof lane.archivos === "number" &&
      typeof lane.concurrencia === "number"));
    assert.equal(report.distribucion.reduce((total, lane) => total + lane.concurrencia, 0), 12);
    assert.equal(report.distribucion.reduce((total, lane) => total + lane.archivos, 0), 22);
    rmSync(join(root, "dist", ".test-runner-durations.json"), { force: true });
    writeFileSync(join(root, "dist", "pipeline", "publication", "tests", "individual-finish.test.js"),
      'import test from "node:test"; test("fallo de cola intensiva", () => { throw new Error("fallo controlado"); });\n');
    const failed = spawnRunner(root, ["--concurrencia=12", "--medicion", reportFile]);
    assert.equal(failed.status, 1, `${failed.stdout}${failed.stderr}`);
    assert.match(failed.stdout, /fallo de cola intensiva/);
    const failedReport: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(failedReport !== null && typeof failedReport === "object" &&
      "resumen" in failedReport && failedReport.resumen !== null && typeof failedReport.resumen === "object" &&
      "fallidos" in failedReport.resumen && "correctos" in failedReport.resumen &&
      "distribucion" in failedReport && Array.isArray(failedReport.distribucion));
    assert.equal(failedReport.resumen.fallidos, 1);
    assert.equal(failedReport.resumen.correctos, 21);
    assert.equal(failedReport.distribucion.length, 2);
  });
});

test("el runner propaga al comando el error de una prueba MJS", () => {
  withRunner((root) => {
    writeFileSync(join(root, "scripts", "inspection", "tests", "prueba.test.mjs"),
      'import test from "node:test"; test("prueba MJS fallida", () => { throw new Error("fallo controlado"); });\n');
    const result = spawnRunner(root, []);
    assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /prueba MJS fallida/);
    assert.match(result.stdout, /1 fallidos/);
  });
});

test("el runner usa la concurrencia adaptativa predeterminada", () => {
  withRunner((root) => {
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(typeof report === "object" && report !== null && "concurrencia" in report);
    assert.equal(report.concurrencia, Math.min(12, Math.max(1, availableParallelism())));
  });
});

test("el runner adelanta las pruebas costosas y no confunde recepción con finalización", () => {
  withRunner((root) => {
    const relativeFile = join("pipeline", "publication", "tests", "individual-editorial.test.js");
    const compiledFile = join(root, "dist", relativeFile);
    const sourceFile = join(root, "src", "pipeline", "publication", "tests", "individual-editorial.test.ts");
    mkdirSync(dirname(compiledFile), { recursive: true });
    mkdirSync(dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, "export {};\n");
    writeFileSync(compiledFile,
      'import test from "node:test"; test("prueba lenta", async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });\n');
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--concurrencia=2", "--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(typeof report === "object" && report !== null && "archivos" in report && Array.isArray(report.archivos));
    const entries = report.archivos;
    const priority = entries.find((entry: unknown) =>
      typeof entry === "object" && entry !== null && "archivo" in entry &&
      typeof entry.archivo === "string" && entry.archivo.replaceAll("\\", "/").endsWith(relativeFile.replaceAll("\\", "/")));
    assert.ok(priority && "inicio_ms" in priority && typeof priority.inicio_ms === "number");
    const base = entries.find((entry: unknown) =>
      typeof entry === "object" && entry !== null && "archivo" in entry &&
      typeof entry.archivo === "string" && entry.archivo.endsWith("prueba.test.js"));
    assert.ok(base && "inicio_ms" in base && typeof base.inicio_ms === "number");
    assert.ok(priority.inicio_ms <= base.inicio_ms);
    for (const entry of entries) {
      assert.ok(typeof entry === "object" && entry !== null && "inicio_ms" in entry &&
        "fin_ms" in entry && "tiempo_ms" in entry && "informe_recibido_ms" in entry);
      assert.ok(typeof entry.inicio_ms === "number" && typeof entry.fin_ms === "number" &&
        typeof entry.tiempo_ms === "number" && typeof entry.informe_recibido_ms === "number");
      assert.ok(Math.abs(entry.inicio_ms + entry.tiempo_ms - entry.fin_ms) < 0.01);
    }
  });
});


test("el runner aprende las duraciones sin cambiar el resultado ni publicar artefactos", () => {
  withRunner((root) => {
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const file = join(root, "dist", ".test-runner-durations.json");
    const profile: unknown = JSON.parse(readFileSync(file, "utf8"));
    assert.ok(profile && typeof profile === "object" && "durations" in profile);
    assert.ok(profile.durations && typeof profile.durations === "object" &&
      "dist/prueba.test.js" in profile.durations && "scripts/inspection/tests/prueba.test.mjs" in profile.durations);
    assert.equal(typeof profile.durations["dist/prueba.test.js"], "number");
    assert.equal(typeof profile.durations["scripts/inspection/tests/prueba.test.mjs"], "number");
  });
});

test("el runner prioriza el trabajo más lento según el perfil de la misma concurrencia", () => {
  withRunner((root) => {
    writeFileSync(join(root, "dist", ".test-runner-durations.json"), JSON.stringify({
      version: 1, platform: process.platform, concurrency: 1,
      durations: { "dist/prueba.test.js": 1, "scripts/inspection/tests/prueba.test.mjs": 50000 }
    }));
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--concurrencia", "1", "--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(report && typeof report === "object" && "archivos" in report && Array.isArray(report.archivos));
    const file = report.archivos.find((item: unknown) =>
      item !== null && typeof item === "object" && "archivo" in item &&
      typeof item.archivo === "string" && item.archivo.replaceAll("\\", "/").endsWith("scripts/inspection/tests/prueba.test.mjs"));
    const base = report.archivos.find((item: unknown) =>
      item !== null && typeof item === "object" && "archivo" in item &&
      typeof item.archivo === "string" && item.archivo.replaceAll("\\", "/").endsWith("dist/prueba.test.js"));
    assert.ok(file && base && "inicio_ms" in file && "inicio_ms" in base &&
      typeof file.inicio_ms === "number" && typeof base.inicio_ms === "number");
    assert.ok(file.inicio_ms < base.inicio_ms);
  });
});

test("perfiles dañados no impiden los tests ni se sobrescribe un perfil tras un FAIL", () => {
  withRunner((root) => {
    const profileFile = join(root, "dist", ".test-runner-durations.json");
    writeFileSync(profileFile, "INVALID JSON");
    assert.equal(spawnRunner(root, []).status, 0);
    const before = readFileSync(profileFile, "utf8");
    writeFileSync(join(root, "scripts", "inspection", "tests", "prueba.test.mjs"),
      'import test from "node:test"; test("falla", () => { throw new Error("controlado"); });\n');
    const failed = spawnRunner(root, []);
    assert.equal(failed.status, 1, `${failed.stdout}${failed.stderr}`);
    assert.equal(readFileSync(profileFile, "utf8"), before);
  });
});


test("sin perfil previo adelanta FINISH y acreditación antes que las suites ligeras", () => {
  withRunner((root) => {
    const files = [
      "pipeline/publication/tests/individual-finish.test",
      "pipeline/publication/tests/individual-accreditation-session.test"
    ];
    for (const path of files) {
      const source = join(root, "src", `${path}.ts`);
      const compiled = join(root, "dist", `${path}.js`);
      mkdirSync(dirname(source), { recursive: true });
      mkdirSync(dirname(compiled), { recursive: true });
      writeFileSync(source, "export {};\n");
      writeFileSync(compiled, 'import test from "node:test"; test("protegida", () => {});\n');
    }
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--concurrencia", "1", "--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(report && typeof report === "object" && "archivos" in report && Array.isArray(report.archivos));
    const starts = new Map<string, number>();
    for (const item of report.archivos) {
      if (item && typeof item === "object" && "archivo" in item && "inicio_ms" in item &&
        typeof item.archivo === "string" && typeof item.inicio_ms === "number") {
        starts.set(item.archivo.replaceAll("\\", "/"), item.inicio_ms);
      }
    }
    const getStart = (suffix: string): number => {
      const item = [...starts].find(([key]) => key.endsWith(suffix));
      assert.ok(item);
      return item[1];
    };
    assert.ok(getStart("individual-finish.test.js") < getStart("individual-accreditation-session.test.js"));
    assert.ok(getStart("individual-accreditation-session.test.js") < getStart("dist/prueba.test.js"));
  });
});

const addCacheableSuites = (root: string): void => {
  for (const name of ["individual-finish", "individual-accreditation-session"]) {
    const source = join(root, "src", "pipeline", "publication", "tests", `${name}.test.ts`);
    const compiled = join(root, "dist", "pipeline", "publication", "tests", `${name}.test.js`);
    mkdirSync(dirname(source), { recursive: true });
    mkdirSync(dirname(compiled), { recursive: true });
    writeFileSync(source, 'export {};\n');
    writeFileSync(compiled, `import { appendFileSync } from "node:fs"; import test from "node:test"; test("${name}", () => appendFileSync("ejecuciones-cache.txt", "${name}\\n"));\n`);
  }
};

test("npm test reutiliza automáticamente solo suites seguras cuando no cambia ninguna entrada", () => {
  withRunner((root) => {
    addCacheableSuites(root);
    const initial = spawnRunner(root, []);
    assert.equal(initial.status, 0, `${initial.stdout}${initial.stderr}`);
    assert.match(initial.stdout, /CACHÉ \| 0 suites/);
    const first = readFileSync(join(root, "ejecuciones-cache.txt"), "utf8");
    assert.equal(first.trim().split("\n").length, 2);
    const next = spawnRunner(root, []);
    assert.equal(next.status, 0, `${next.stdout}${next.stderr}`);
    assert.match(next.stdout, /CACHÉ \| 2 suites y 2 tests reutilizados \| 2 suites ejecutadas/);
    assert.match(next.stdout, /4 correctos \(2 reutilizados\)/);
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
    assert.match(sourceChanged.stdout, /CACHÉ \| 0 suites/);
    assert.equal(spawnRunner(root, []).status, 0);
    mkdirSync(join(root, "catalogs"));
    writeFileSync(join(root, "catalogs", "fixture.json"), '{"valor":1}');
    const fixtureChanged = spawnRunner(root, []);
    assert.equal(fixtureChanged.status, 0, `${fixtureChanged.stdout}${fixtureChanged.stderr}`);
    assert.match(fixtureChanged.stdout, /CACHÉ \| 0 suites/);
    assert.equal(spawnRunner(root, []).status, 0);
    const environmentChanged = spawnRunner(root, [], { EQUIPZILLA_TEST_CONTEXT: "otro" });
    assert.equal(environmentChanged.status, 0, `${environmentChanged.stdout}${environmentChanged.stderr}`);
    assert.match(environmentChanged.stdout, /CACHÉ \| 0 suites/);
  });
});

test("mediciones, concurrencia personalizada y CI ejecutan toda la batería", () => {
  withRunner((root) => {
    addCacheableSuites(root);
    assert.equal(spawnRunner(root, []).status, 0);
    const cached = spawnRunner(root, []);
    assert.match(cached.stdout, /CACHÉ \| 2 suites/);
    const reportPath = join(root, "medicion.json");
    const measured = spawnRunner(root, ["--medicion", reportPath]);
    assert.equal(measured.status, 0, `${measured.stdout}${measured.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportPath, "utf8"));
    assert.ok(report && typeof report === "object" && "resumen" in report &&
      report.resumen && typeof report.resumen === "object" && "cache" in report.resumen);
    assert.deepEqual(report.resumen.cache, { reutilizados: 0, ejecutados: 4, tests_reutilizados: 0 });
    const manual = spawnRunner(root, ["--concurrencia", "2"]);
    assert.equal(manual.status, 0, `${manual.stdout}${manual.stderr}`);
    assert.doesNotMatch(manual.stdout, /CACHÉ \| 2 suites/);
    const ci = spawnRunner(root, [], { CI: "true" });
    assert.equal(ci.status, 0, `${ci.stdout}${ci.stderr}`);
    assert.doesNotMatch(ci.stdout, /CACHÉ \| 2 suites/);
    const forced = spawnRunner(root, [], { EQUIPZILLA_TEST_CACHE: "0" });
    assert.equal(forced.status, 0, `${forced.stdout}${forced.stderr}`);
    assert.doesNotMatch(forced.stdout, /CACHÉ \| 2 suites/);
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
    assert.match(corrupted.stdout, /CACHÉ \| 0 suites/);
    const script = join(root, "scripts", "inspection", "tests", "prueba.test.mjs");
    writeFileSync(script, 'import test from "node:test"; test("falla", () => { throw new Error("fallo"); });\n');
    const failed = spawnRunner(root, []);
    assert.equal(failed.status, 1, `${failed.stdout}${failed.stderr}`);
    assert.match(failed.stdout, /1 fallidos/);
    writeFileSync(script, 'import test from "node:test"; test("prueba MJS", () => {});\n');
    const following = spawnRunner(root, []);
    assert.equal(following.status, 0, `${following.stdout}${following.stderr}`);
    assert.match(following.stdout, /CACHÉ \| 0 suites/);
  });
});

const addAuditedCatalogSuites = (root: string): void => {
  for (const name of ["alpha", "beta"]) {
    const sourceDir = join(root, "src", "catalog", "preparation", "tests", "cache");
    const compiledDir = join(root, "dist", "catalog", "preparation", "tests", "cache");
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(compiledDir, { recursive: true });
    writeFileSync(join(sourceDir, `${name}-helper.ts`), "export const value = 1;\n");
    writeFileSync(join(compiledDir, `${name}-helper.js`), "export const value = 1;\n");
    writeFileSync(join(sourceDir, `${name}.test.ts`), `import { value } from "./${name}-helper.js";\nexport { value };\n`);
    writeFileSync(join(compiledDir, `${name}.test.js`),
      `import test from "node:test"; import { value } from "./${name}-helper.js"; test("${name}", () => { if (value !== 1) throw new Error("valor modificado"); });\n`);
  }
};

test("la caché automática abarca suites de preparación auditadas sin nuevos comandos", () => {
  withRunner((root) => {
    addAuditedCatalogSuites(root);
    const first = spawnRunner(root, []);
    assert.equal(first.status, 0, `${first.stdout}${first.stderr}`);
    assert.match(first.stdout, /CACHÉ \| 0 suites/);
    const second = spawnRunner(root, []);
    assert.equal(second.status, 0, `${second.stdout}${second.stderr}`);
    assert.match(second.stdout, /CACHÉ \| 2 suites y 2 tests reutilizados \| 2 suites ejecutadas/);
    assert.match(second.stdout, /4 correctos \(2 reutilizados\)/);
  });
});

test("el cambio de una dependencia invalida solo su suite, no las demás", () => {
  withRunner((root) => {
    addAuditedCatalogSuites(root);
    assert.equal(spawnRunner(root, []).status, 0);
    assert.equal(spawnRunner(root, []).status, 0);
    const source = join(root, "src", "catalog", "preparation", "tests", "cache", "alpha-helper.ts");
    const compiled = join(root, "dist", "catalog", "preparation", "tests", "cache", "alpha-helper.js");
    writeFileSync(source, "export const value =  1;\n");
    writeFileSync(compiled, "export const value =  1;\n");
    const changed = spawnRunner(root, []);
    assert.equal(changed.status, 0, `${changed.stdout}${changed.stderr}`);
    assert.match(changed.stdout, /CACHÉ \| 1 suites y 1 tests reutilizados \| 3 suites ejecutadas/);
    assert.equal(spawnRunner(root, []).status, 0);
    const unrelated = join(root, "src", "catalog", "unrelated.ts");
    writeFileSync(unrelated, "export const unaffected = true;\n");
    const independent = spawnRunner(root, []);
    assert.equal(independent.status, 0, `${independent.stdout}${independent.stderr}`);
    assert.match(independent.stdout, /CACHÉ \| 2 suites y 2 tests reutilizados \| 2 suites ejecutadas/);
  });
});

test("los datos externos solo invalidan suites que dependen de ellos", () => {
  withRunner((root) => {
    addAuditedCatalogSuites(root);
    const sourceDir = join(root, "src", "catalog", "preparation", "tests", "cache");
    const compiledDir = join(root, "dist", "catalog", "preparation", "tests", "cache");
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
    assert.match(second.stdout, /CACHÉ \| 3 suites y 3 tests reutilizados \| 3 suites ejecutadas/);
    writeFileSync(join(root, "catalogs", "nuevo.json"), '{"revision":2}');
    const changed = spawnRunner(root, []);
    assert.equal(changed.status, 0, `${changed.stdout}${changed.stderr}`);
    assert.match(changed.stdout, /CACHÉ \| 2 suites y 2 tests reutilizados \| 4 suites ejecutadas/);
    const unrelated = join(root, "docs");
    mkdirSync(unrelated);
    writeFileSync(join(unrelated, "notes.md"), "Actualización editorial");
    const docsChanged = spawnRunner(root, []);
    assert.equal(docsChanged.status, 0, `${docsChanged.stdout}${docsChanged.stderr}`);
    assert.match(docsChanged.stdout, /CACHÉ \| 2 suites y 2 tests reutilizados \| 4 suites ejecutadas/);
  });
});

test("importaciones dinámicas y módulos externos quedan fuera de la caché", () => {
  withRunner((root) => {
    addAuditedCatalogSuites(root);
    const sourceDir = join(root, "src", "catalog", "preparation", "tests", "cache");
    const compiledDir = join(root, "dist", "catalog", "preparation", "tests", "cache");
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
    assert.match(again.stdout, /CACHÉ \| 2 suites y 2 tests reutilizados \| 4 suites ejecutadas/);
  });
});

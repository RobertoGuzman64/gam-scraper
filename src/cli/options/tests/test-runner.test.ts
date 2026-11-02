import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

const spawnRunner = (root: string, args: readonly string[]) => {
  const env = { ...process.env };
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
    assert.equal(report.concurrencia, Math.min(12, Math.max(1, availableParallelism() * 2)));
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

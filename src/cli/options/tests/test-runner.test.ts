import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

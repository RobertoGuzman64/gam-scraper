import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";
import { formatScriptStatus, supportsScriptAnimation, supportsScriptColor } from "../terminal.mjs";
import compactGuardTestReporter, {
  createRunnerDisplay, formatRunnerCompletion, formatRunnerFailure, formatRunnerLog, formatRunnerOmission, supportsInteractiveRunner,
  formatRunnerProgress, formatRunnerRegression, formatRunnerTime
} from "../test-runner-ui.mjs";

const state = (overrides = {}) => ({
  progress: {
    total: 416, reused: 285, started: 120, reported: 399, without_report: 6,
    not_started: 11, remaining: 17,
    oldest_without_report: [{ file: "/repositorio/dist/publication/tests/individual-finish.test.js", elapsed_ms: 31000 }]
  },
  counts: { passed: 1715, failed: 0, skipped: 1, todo: 0 },
  lanes: [
    { name: "intensiva", files: 16, reported: 12, finished_ms: null },
    { name: "general", files: 115, reported: 102, finished_ms: null }
  ],
  cachedTests: 1153, elapsed_ms: 81000, laneFinished: false,
  ...overrides
});

const plain = (value) => value.replace(/\u001b\[[\d;]*m/g, "");

test("el progreso distingue informes, inicios, pendientes, colas y reutilización", () => {
  const lines = formatRunnerProgress(state(), 120);
  assert.equal(lines.length, 7);
  assert.match(lines[1], /399\/416 INFORMES.*17 PENDIENTES/);
  assert.match(lines[2], /OK 1\.715.*FALLOS 0.*OMITIDOS 1/);
  assert.match(lines[3], /CACHÉ 285 suites \/ 1\.153 tests.*EJECUCIÓN 131 suites/);
  assert.match(lines[4], /INICIADOS 120\/131.*SIN INFORME 6.*EN COLA 11/);
  assert.match(lines[5], /INTENSIVA 12\/16.*GENERAL 102\/115/);
  assert.match(lines[6], /INFORME PENDIENTE HACE 00:31.*individual-finish\.test\.js/);
  assert.ok(lines.every((line) => line.length < 120));
});

test("cuando llegan todos los informes pero no han cerrado las colas no anticipa PASS", () => {
  const pending = state({ progress: { ...state().progress, remaining: 0, reported: 416, without_report: 0, not_started: 0, oldest_without_report: [] } });
  assert.match(formatRunnerProgress(pending)[0], /CERRANDO EJECUTORES/);
  assert.match(formatRunnerProgress(pending)[6], /cerrando ejecutores/);
  assert.match(formatRunnerLog(pending), /cerrando ejecutores/);
  assert.match(formatRunnerProgress({ ...pending, laneFinished: true })[0], /FINALIZADO/);
});

test("terminales pequeñas, colores y espacios disponibles no producen saltos de línea", () => {
  for (const width of [40, 55, 69, 70, 80, 120]) {
    const lines = formatRunnerProgress(state(), width);
    const colored = formatRunnerProgress(state(), width, true);
    assert.equal(lines.length, 7);
    assert.ok(lines.every((line) => line.length < width), `${width}: ${lines.join("\n")}`);
    assert.ok(colored.every((line) => plain(line).length < width));
    assert.ok(colored.some((line) => /\u001b\[/.test(line)));
  }
  assert.doesNotMatch(formatRunnerLog(state()), /\u001b\[/);
  assert.match(formatRunnerLog(state()), /399\/416 con informe/);
  assert.equal(formatRunnerTime(109573), "01:49");
  assert.equal(formatRunnerTime(3661000), "1:01:01");
});

test("el panel se repinta sobre el mismo bloque y libera la región antes del resumen", () => {
  const stream = new PassThrough();
  stream.isTTY = true;
  stream.columns = 96;
  let written = "";
  stream.on("data", (chunk) => { written += chunk.toString(); });
  let current = state();
  const display = createRunnerDisplay(stream, { interactive: true, getState: () => current, now: () => 0 });
  display.show();
  current = state({ counts: { passed: 1725, failed: 1, skipped: 1, todo: 0 } });
  display.tick();
  display.finish();
  assert.match(written, /EQUIPZILLA/);
  assert.match(written, /FALLOS 1/);
  assert.match(written, /\u001b\[6A/);
  assert.match(written, /\u001b\[0J$/);
  assert.ok(written.length < 4000);
});

test("el resumen final es compacto, único y conserva todos los contadores en cada anchura", () => {
  const finished = state({
    progress: { ...state().progress, reported: 416, remaining: 0, without_report: 0, not_started: 0, oldest_without_report: [] },
    lanes: [
      { name: "intensiva", files: 16, reported: 16, finished_ms: 54500 },
      { name: "general", files: 115, reported: 115, finished_ms: 43000 }
    ]
  });
  for (const width of [45, 80, 110, 160]) {
    const lines = formatRunnerCompletion({ ...finished, success: true }, width, true);
    const output = plain(lines.join("\n"));
    for (const expected of ["PASS | TESTS", "416/416 suites", "1.715 correctos", "0 fallidos", "1 omitidos", "0 TODO", "caché 285 suites / 1.153 tests", "01:21"]) {
      assert.ok(output.includes(expected), expected);
    }
    assert.equal(output.match(/PASS \| TESTS/g)?.length, 1);
    assert.ok(lines.every((line) => plain(line).length < width), width);
    assert.ok(lines.length <= 4);
  }
  assert.match(formatRunnerCompletion({ ...finished, success: false }, 100).join("\n"), /^FAIL \| TESTS/);
  assert.doesNotMatch(formatRunnerCompletion({ ...finished, success: true }, 100).join("\n"), /\u001b\[/);
});

test("los avisos de rendimiento son legibles sin perder las cifras ni envolver líneas", () => {
  const path = "dist/campaign/tests/finalization-and-delivery/finalization-interventions.test.js";
  const output = formatRunnerRegression({ file: path, before: 10397, after: 22061 }, 73);
  assert.ok(output.trimEnd().length < 73);
  assert.match(output, /finalization-interventions\.test\.js/);
  assert.match(output, /10397 -> 22061 ms/);
});

test("las omisiones conocidas conservan un motivo explícito en Windows", () => {
  const item = { name: "rechaza enlaces simbólicos a publicaciones antes de proponer el archivado", file: "scripts/maintenance/tests/consolidate-local-artifacts.test.mjs", line: 139, reason: true };
  assert.match(formatRunnerOmission(item, "win32"), /Windows: la creación de enlaces simbólicos/);
  assert.match(formatRunnerOmission({ ...item, reason: "Permisos insuficientes" }, "win32"), /Permisos insuficientes/);
  assert.match(formatRunnerOmission({ ...item, name: "otra prueba" }, "win32"), /omisión sin motivo proporcionado/);
});

test("los logs de CI no contienen control de terminal y mantienen una cadencia moderada", () => {
  const stream = new PassThrough();
  let written = "";
  stream.on("data", (chunk) => { written += chunk.toString(); });
  let elapsed = 0;
  const display = createRunnerDisplay(stream, { interactive: false, getState: state, now: () => elapsed, intervalMs: 10000 });
  display.tick();
  elapsed = 9000;
  display.tick();
  assert.equal(written, "");
  elapsed = 10001;
  display.tick();
  elapsed = 11000;
  display.tick();
  assert.equal(written.split("\n").filter(Boolean).length, 1);
  assert.doesNotMatch(written, /\u001b\[/);
});


test("la salida no interactiva registra los cambios de fallo al instante y limita el progreso rutinario", () => {
  const stream = new PassThrough();
  let written = "";
  stream.on("data", (chunk) => { written += chunk.toString(); });
  let elapsed = 0;
  let current = state();
  const display = createRunnerDisplay(stream, { interactive: false, getState: () => current, now: () => elapsed });
  elapsed = 59000;
  display.tick();
  assert.equal(written, "");
  elapsed = 60001;
  display.tick();
  assert.equal(written.split("\n").filter(Boolean).length, 1);
  elapsed = 61000;
  current = state({ counts: { passed: 1715, failed: 1, skipped: 1, todo: 0 } });
  display.tick();
  assert.match(written, /1 fallidos/);
  assert.equal(written.split("\n").filter(Boolean).length, 2);
  elapsed = 63000;
  display.tick();
  assert.equal(written.split("\n").filter(Boolean).length, 2);
});

test("el formateador preserva el error completo y stderr sin degradar diagnósticos", () => {
  const failure = plain(formatRunnerFailure({
    name: "conciliación histórica", file: "scripts/operations/tests/historia.test.mjs", line: 42,
    error: new Error("diferencia de concepto"), stderr: "ERROR: código semántico\n", stdout: "DIAGNÓSTICO: datos originales\n"
  }));
  assert.match(failure, /FAIL \| conciliación histórica/);
  assert.match(failure, /historia\.test\.mjs:42/);
  assert.match(failure, /Error: diferencia de concepto/);
  assert.match(failure, /scripts\/tests\/test-runner-ui\.test\.mjs/);
  assert.match(failure, /ERROR: código semántico/);
  assert.match(failure, /DIAGNÓSTICO: datos originales/);
  assert.match(formatRunnerFailure({ name: "sin dato" }), /Node no proporcionó detalles adicionales/);
});

test("el reporter de guards resume éxitos y muestra nombre, error, stack y stderr ante fallo", async () => {
  const events = async function* () {
    yield { type: "test:pass", data: { name: "pasa", details: { type: "test" } } };
    yield { type: "test:fail", data: { name: "falla", file: "ruta.mjs", line: 12, details: { error: new Error("fallo trazado") } } };
    yield { type: "test:stderr", data: { message: "diagnóstico stderr\n" } };
    yield { type: "test:diagnostic", data: { message: "hallazgo relevante" } };
    yield { type: "test:diagnostic", data: { message: "pass 1" } };
    yield { type: "test:summary", data: { success: false, counts: { passed: 1, failed: 1, cancelled: 0, skipped: 0 }, duration_ms: 1000 } };
  };
  const output = [];
  for await (const part of compactGuardTestReporter(events())) output.push(part);
  const result = plain(output.join(""));
  assert.doesNotMatch(result, /PASS \| pasa/);
  assert.match(result, /FAIL \| falla \(ruta\.mjs:12\)/);
  assert.match(result, /fallo trazado/);
  assert.match(result, /diagnóstico stderr/);
  assert.match(result, /hallazgo relevante/);
  assert.match(result, /FAIL \| GUARDS \| 1 correctos \| 1 fallidos/);
});

test("el reporter real conserva el código de salida y la aserción fallida", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "eqz-reporter-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "guard-failure.test.mjs");
  writeFileSync(source, "import test from 'node:test'; import assert from 'node:assert/strict'; test('debe fallar', () => assert.equal(1, 2));\n");
  const reporter = new URL("../test-runner-ui.mjs", import.meta.url).href;
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--test", `--test-reporter=${reporter}`, source], { env, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
  const output = plain(`${result.stdout}${result.stderr}`);
  assert.equal(result.status, 1, output);
  assert.match(output, /FAIL \| debe fallar/);
  assert.match(output, /1 !== 2/);
  assert.match(output, /guard-failure\.test\.mjs:1/);
  assert.match(output, /FAIL \| GUARDS/);
});

test("la consola clásica de Windows usa progreso por líneas sin controlar el cursor", () => {
  const stream = { isTTY: true };
  assert.equal(supportsInteractiveRunner(stream, "win32", { CI: "false" }), false);
  assert.equal(supportsInteractiveRunner(stream, "win32", { CI: "false", WT_SESSION: "terminal" }), true);
  assert.equal(supportsInteractiveRunner(stream, "win32", { CI: "false", TERM_PROGRAM: "vscode" }), true);
  assert.equal(supportsInteractiveRunner(stream, "linux", { CI: "false" }), true);
  assert.equal(supportsInteractiveRunner(stream, "linux", { CI: "true" }), false);
  assert.equal(supportsInteractiveRunner({ isTTY: false }, "win32", { CI: "false" }), false);
});

test("no repinta un estado idéntico y no acumula escrituras de cursor", () => {
  const stream = new PassThrough();
  stream.isTTY = true;
  stream.columns = 100;
  let written = "";
  stream.on("data", (chunk) => { written += chunk.toString(); });
  const display = createRunnerDisplay(stream, { interactive: true, getState: state, now: () => 0 });
  display.show();
  const before = written.length;
  display.tick();
  display.tick();
  assert.equal(written.length, before);
  display.finish();
});

test("los estados reutilizados muestran PASS verde y FAIL rojo, con exclusiones explícitas", () => {
  const tty = { isTTY: true };
  const enabled = { CI: "false", TERM: "xterm-256color" };
  assert.equal(supportsScriptColor(tty, enabled, "linux"), true);
  assert.equal(supportsScriptColor(tty, { ...enabled, NO_COLOR: "1" }, "linux"), false);
  assert.equal(supportsScriptColor(tty, { ...enabled, CI: "true" }, "linux"), false);
  assert.equal(supportsScriptColor(tty, enabled, "win32"), true);
  assert.equal(supportsScriptAnimation(tty, "win32", enabled), false);
  assert.equal(supportsScriptColor({ isTTY: false }, { ...enabled, FORCE_COLOR: "1" }, "linux"), true);
  assert.equal(supportsScriptColor({ isTTY: false }, { ...enabled, TERM: "dumb", FORCE_COLOR: "1" }, "linux"), true);
  assert.equal(supportsScriptColor({ isTTY: false }, { ...enabled, FORCE_COLOR: "0" }, "linux"), false);
  assert.equal(supportsScriptColor(tty, { ...enabled, FORCE_COLOR: "0" }, "linux"), false);
  if (supportsScriptColor(tty)) {
    assert.match(formatScriptStatus("PASS", "correcto", tty), /\u001b\[32mPASS\u001b\[0m \| correcto/);
    assert.match(formatScriptStatus("FAIL", "fallo", tty), /\u001b\[31mFAIL\u001b\[0m \| fallo/);
  }
});

test("npm test oculta el encabezado largo sin silenciar errores ni estados de salida", (t) => {
  const root = mkdtempSync(join(tmpdir(), "eqz-npm-console-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const config = readFileSync(new URL("../../.npmrc", import.meta.url), "utf8");
  writeFileSync(join(root, ".npmrc"), config);
  const packageFile = join(root, "package.json");
  const nodeDirectory = dirname(process.execPath);
  const npmCli = [
    process.env.npm_execpath,
    join(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
    join(nodeDirectory, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")
  ].find((candidate) => candidate?.endsWith("npm-cli.js") && existsSync(candidate));
  assert.ok(npmCli, "No se ha encontrado el CLI de npm para verificar la salida");
  const execute = (script) => {
    writeFileSync(packageFile, JSON.stringify({ name: "terminal-verification", version: "1.0.0", scripts: { test: script } }));
    return spawnSync(process.execPath, [npmCli, "test"], {
      cwd: root, encoding: "utf8", windowsHide: true
    });
  };
  const passed = execute('node -e "console.log(\'PASS | control\')"');
  assert.equal(passed.status, 0, `${passed.stdout}${passed.stderr}${passed.error ?? ""}`);
  assert.match(passed.stdout, /PASS \| control/);
  assert.doesNotMatch(passed.stdout, /^> terminal-verification/m);
  const failed = execute('node -e "console.error(\'FAIL | control\'); process.exitCode=1"');
  assert.equal(failed.status, 1, `${failed.stdout}${failed.stderr}${failed.error ?? ""}`);
  assert.match(`${failed.stdout}${failed.stderr}`, /FAIL \| control/);
  assert.doesNotMatch(`${failed.stdout}${failed.stderr}`, /^> terminal-verification/m);
});


test("build y herramientas no animan en consola clásica de Windows ni en pipes", () => {
  const env = { TERM: "xterm-256color" };
  assert.equal(supportsScriptAnimation({ isTTY: true }, "win32", env), false);
  assert.equal(supportsScriptColor({ isTTY: true }, env, "win32"), true);
  assert.equal(supportsScriptColor({ isTTY: true }, { ...env, FORCE_COLOR: "1" }, "win32"), true);
  assert.equal(supportsScriptAnimation({ isTTY: true }, "win32", { ...env, WT_SESSION: "terminal" }), true);
  assert.equal(supportsScriptAnimation({ isTTY: true }, "win32", { ...env, TERM_PROGRAM: "vscode" }), true);
  assert.equal(supportsScriptAnimation({ isTTY: true }, "win32", { ...env, ConEmuANSI: "ON" }), true);
  assert.equal(supportsScriptAnimation({ isTTY: false }, "win32", { ...env, WT_SESSION: "terminal" }), false);
  assert.equal(supportsScriptAnimation({ isTTY: true }, "linux", { ...env, NO_COLOR: "1" }), false);
  assert.equal(supportsScriptAnimation({ isTTY: true }, "linux", { ...env, CI: "true" }), false);
  assert.equal(supportsScriptAnimation({ isTTY: true }, "linux", { ...env, TERM: "dumb" }), false);
});

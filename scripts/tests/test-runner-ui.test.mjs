import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  createRunnerDisplay, formatRunnerCompletion, formatRunnerLog, formatRunnerOmission, supportsInteractiveRunner,
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

test("el resumen final persistente identifica resultado, caché y tiempos de colas", () => {
  const finished = state({
    progress: { ...state().progress, reported: 416, remaining: 0, without_report: 0, not_started: 0, oldest_without_report: [] },
    lanes: [
      { name: "intensiva", files: 16, reported: 16, finished_ms: 54500 },
      { name: "general", files: 115, reported: 115, finished_ms: 43000 }
    ]
  });
  for (const width of [45, 80, 110, 160]) {
    const lines = formatRunnerCompletion({ ...finished, success: true,
      slowest: { file: "dist/campaign/tests/finalization-and-delivery/finalization-interventions.test.js", milliseconds: 22061 }
    }, width, true);
    assert.match(plain(lines.join("\n")), /CORRECTO/);
    assert.match(plain(lines.join("\n")), /Caché: 285 suites \/ 1\.153 tests/);
    assert.match(plain(lines.join("\n")), /INTENSIVA 16\/16[\s\S]*GENERAL 115\/115/);
    assert.match(plain(lines.join("\n")), /Suite más lenta:[\s\S]*finalization-interventions\.test\.js/);
    assert.match(plain(lines.join("\n")), /00:22/);
    assert.ok(lines.every((line) => plain(line).length < width));
  }
  assert.match(formatRunnerCompletion({ ...finished, success: false }, 100).join("\n"), /FALLIDO/);
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

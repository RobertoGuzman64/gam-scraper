import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join, relative, resolve } from "node:path";
import { run } from "node:test";
import { formatScriptStatus } from "./terminal.mjs";
import { createRunnerTimeline } from "./test-runner-observability.mjs";
import { createRunnerDisplay, formatRunnerCompletion, formatRunnerOmission, formatRunnerRegression, formatRunnerTime } from "./test-runner-ui.mjs";
import { durationRegressions, loadTestDurations, orderTestsByDuration, planTestLanes, recommendedTestConcurrency, saveTestDurations } from "./test-performance.mjs";
import { discardTestResultsCache, fingerprintTestInputs, loadTestResultsCache, relativeCacheFile, saveTestResultsCache } from "./test-result-cache.mjs";

const parseOptions = (argumentsList) => {
  let concurrency;
  let report;
  let cacheReport;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const concurrencyValue = argument.startsWith("--concurrencia=")
      ? argument.slice("--concurrencia=".length)
      : argument === "--concurrencia"
        ? argumentsList[++index]
        : null;

    if (concurrencyValue !== null) {
      if (!/^[1-9]\d*$/.test(concurrencyValue ?? "") || Number(concurrencyValue) > 64) {
        throw new Error("--concurrencia requiere un entero entre 1 y 64");
      }
      concurrency = Number(concurrencyValue);
      continue;
    }

    const reportValue = argument.startsWith("--medicion=")
      ? argument.slice("--medicion=".length)
      : argument === "--medicion"
        ? argumentsList[++index]
        : null;

    if (reportValue !== null) {
      if (!reportValue || reportValue.startsWith("--")) throw new Error("--medicion requiere una ruta JSON");
      report = reportValue;
      continue;
    }

    const cacheReportValue = argument.startsWith("--medicion-cache=")
      ? argument.slice("--medicion-cache=".length)
      : argument === "--medicion-cache"
        ? argumentsList[++index]
        : null;
    if (cacheReportValue !== null) {
      if (!cacheReportValue || cacheReportValue.startsWith("--")) throw new Error("--medicion-cache requiere una ruta JSON");
      cacheReport = cacheReportValue;
      continue;
    }

    throw new Error(`Opción de pruebas desconocida: ${argument}`);
  }
  if (report !== undefined && cacheReport !== undefined) throw new Error("No se combinan --medicion y --medicion-cache");
  if (cacheReport !== undefined && concurrency !== undefined) throw new Error("--medicion-cache utiliza la concurrencia habitual");
  return { concurrency, report, cacheReport };
};

const PRIORITIZED_TESTS = [
  "pipeline/publication/tests/individual-finish.test.js",
  "pipeline/publication/tests/individual-finish-cycle.test.js",
  "pipeline/publication/tests/individual-finish-editorial.test.js",
  "pipeline/publication/tests/individual-editorial.test.js",
  "pipeline/publication/tests/individual-accreditation-session.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/delivery-recovery.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/delivery-recovery-resumption.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/delivery-retention.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/delivery-retention-historic.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/delivery.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/finalization-interventions.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/finalization-recovery.test.js",
  "cli/commands/catalog/tests/catalog-content-gaps-comparison.test.js",
  "pipeline/campaign/tests/reference/reference-update.test.js",
  "pipeline/campaign/tests/operations/operations-status.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/finalization-editorial.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/finalization-draft-integrity.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/finalization-operations.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/finalization.test.js",
  "cli/commands/catalog/tests/catalog-content-gaps-discovery.test.js",
  "cli/commands/catalog/tests/catalog-content-gaps.test.js",
  "cli/commands/catalog/tests/catalog-content-gaps-publications.test.js",
  "catalog/interventions/tests/multiple-scripts.test.js",
  "pipeline/campaign/tests/discovery-flow/active-campaign.test.js",
  "infrastructure/filesystem/campaign/tests/portable-campaign.test.js",
  "pipeline/campaign/tests/discovery-flow/workflow.test.js",
  "catalog/interventions/tests/manual-interventions.test.js",
  "catalog/interventions/tests/intervention-application.test.js",
  "catalog/interventions/tests/intervention-simulation.test.js",
  "catalog/interventions/tests/catalog.test.js",
  "infrastructure/filesystem/catalog/tests/campaign-accreditation.test.js"
];
const testPriority = new Map(PRIORITIZED_TESTS.map((path, index) => [path, index]));

const DEFAULT_CONCURRENCY = recommendedTestConcurrency(availableParallelism());
const options = parseOptions(process.argv.slice(2));
const effectiveConcurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

const collectTests = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return collectTests(path);
  return entry.isFile() && entry.name.endsWith(".test.ts") ? [path] : [];
});

const collectScriptTests = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return collectScriptTests(path);
  return entry.isFile() && entry.name.endsWith(".test.mjs") ? [path] : [];
});

const sources = collectTests("src").sort();
const scriptTests = collectScriptTests("scripts").sort();
if (sources.length === 0) throw new Error("No se encontraron pruebas en src");
const files = [
  ...sources.map((source) => join("dist", relative("src", source).replace(/\.test\.ts$/, ".test.js"))),
  ...scriptTests
];
const previousDurations = loadTestDurations(effectiveConcurrency);
orderTestsByDuration(files, previousDurations, testPriority);
const missing = files.filter((file) => !existsSync(file));
if (missing.length > 0) throw new Error(`Faltan ${missing.length} pruebas compiladas: ${missing.join(", ")}`);

const automaticCache = options.concurrency === undefined && options.report === undefined &&
  process.env.EQUIPZILLA_TEST_CACHE !== "0" && !/^(1|true)$/i.test(process.env.CI ?? "");
let inputFingerprints = null;
let cachedResults = new Map();
if (automaticCache) {
  try {
    inputFingerprints = fingerprintTestInputs(files);
    cachedResults = loadTestResultsCache(inputFingerprints);
  } catch (error) {
    process.stdout.write(`${formatScriptStatus("WARN", `CACHÉ | Sin reutilización: ${error instanceof Error ? error.message : String(error)}`)}\n`);
  }
}
const cachedFiles = files.filter((file) => cachedResults.has(relativeCacheFile(file)));
const executableFiles = files.filter((file) => !cachedResults.has(relativeCacheFile(file)));
const lanes = planTestLanes(executableFiles, effectiveConcurrency, previousDurations, PRIORITIZED_TESTS.slice(0, 12));
const cachedCounts = { passed: 0, failed: 0, skipped: 0, todo: 0 };
for (const file of cachedFiles) {
  const value = cachedResults.get(relativeCacheFile(file));
  cachedCounts.passed += value.passed;
}
const filePaths = new Set(executableFiles.map((file) => resolve(file)));
const interactive = process.stdout.isTTY === true && process.env.CI !== "true" && process.env.TERM !== "dumb";
const startedAt = performance.now();
const timeline = createRunnerTimeline(files, cachedFiles, lanes, () => performance.now() - startedAt);
const completedFiles = timeline.reported;
const errors = [];
const skippedTests = [];
const todoTests = [];
const standardErrors = new Map();
const counts = { ...cachedCounts };
const resultsForCache = new Map(cachedResults);
const reportPath = options.report ?? options.cacheReport;
const profile = reportPath ? { tests: [], files: [] } : null;
const durations = [];
const display = createRunnerDisplay(process.stdout, {
  interactive,
  now: () => performance.now() - startedAt,
  getState: () => ({
    progress: timeline.progress(),
    counts,
    lanes: timeline.metrics().lanes,
    cachedTests: cachedCounts.passed,
    elapsed_ms: performance.now() - startedAt,
    laneFinished: timeline.metrics().lanes.every((lane) => lane.finished_ms !== null)
  })
});

const describeError = (error) => {
  if (typeof error === "string") return error === "test failed" ? "" : error;
  if (error && typeof error.stack === "string") return error.stack;
  if (error && typeof error.message === "string") return error.message;
  return "";
};

const summaries = [];
display.show();
const progressTimer = setInterval(() => display.tick(), interactive ? 500 : 1000);

const consumeEvent = (event, laneName) => {
  timeline.register(event, laneName);
  if (profile && (event.type === "test:pass" || event.type === "test:fail") && event.data.details?.type === "test") {
    profile.tests.push({
      archivo: event.data.file ? relative(process.cwd(), event.data.file) : "",
      prueba: event.data.name,
      tiempo_ms: event.data.details.duration_ms ?? 0,
      estado: event.type === "test:fail" ? "fallido" : event.data.skip ? "omitido" : event.data.todo ? "todo" : "correcto"
    });
  }

  if (event.type === "test:summary" && event.data.file) {
    durations.push({ file: event.data.file, milliseconds: event.data.duration_ms ?? 0 });
    const cacheFile = relativeCacheFile(event.data.file);
    if (inputFingerprints?.has(cacheFile)) {
      const value = event.data.counts;
      if (value && value.failed === 0 && value.skipped === 0 && value.todo === 0 &&
        Number.isSafeInteger(value.passed) && value.passed > 0) {
        resultsForCache.set(cacheFile, { fingerprint: inputFingerprints.get(cacheFile), passed: value.passed, failed: 0, skipped: 0, todo: 0 });
      } else resultsForCache.delete(cacheFile);
    }
  }

  if (profile && event.type === "test:summary" && event.data.file) {
    const inicio = timeline.started.get(resolve(event.data.file)) ?? null;
    const duracion = event.data.duration_ms ?? 0;
    const recibido = performance.now() - startedAt;
    profile.files.push({
      archivo: relative(process.cwd(), event.data.file),
      tiempo_ms: duracion,
      inicio_ms: inicio,
      fin_ms: inicio === null ? null : inicio + duracion,
      informe_recibido_ms: recibido,
      retraso_informe_ms: inicio === null ? null : Math.max(0, recibido - inicio - duracion),
      correctos: event.data.counts?.passed ?? 0,
      fallidos: event.data.counts?.failed ?? 0
    });
  }

  if (event.type === "test:stderr") {
    if (event.data.file) {
      const file = resolve(event.data.file);
      standardErrors.set(file, `${standardErrors.get(file) ?? ""}${event.data.message}`);
    }
  }

  if (event.type === "test:pass" && event.data.details?.type === "test") {
    const { name, file, line, skip, todo } = event.data;
    if (skip) {
      counts.skipped += 1;
      skippedTests.push({ name, file, line, reason: skip });
    } else if (todo) {
      counts.todo += 1;
      todoTests.push({ name, file, line, reason: todo });
    } else {
      counts.passed += 1;
    }
  }

  if (event.type === "test:fail") {
    const { name, file, line, details, todo } = event.data;
    if (todo && details?.type === "test") {
      counts.todo += 1;
      todoTests.push({ name, file, line, reason: todo });
    } else {
      const fileFailure = filePaths.has(resolve(name));
      counts.failed += 1;
      errors.push({ name, file, line, fileFailure, error: details?.error?.cause ?? details?.error });
    }
  }

  if (event.type === "test:summary") {
    if (!event.data.file) summaries.push(event.data);
  }

};
try {
  await Promise.all(lanes.map(async (lane) => {
    try {
      for await (const event of run({ files: lane.files, concurrency: lane.concurrency })) consumeEvent(event, lane.name);
    } finally {
      timeline.finishLane(lane.name);
    }
  }));
} finally {
  clearInterval(progressTimer);
  display.finish();
}
if (summaries.length !== lanes.length) throw new Error("La ejecución de pruebas terminó sin todos los resúmenes");
const elapsedDuration = performance.now() - startedAt;
const timelineMetrics = timeline.metrics();
const summary = {
  success: summaries.every((item) => item.success),
  duration_ms: elapsedDuration,
  counts: {
    passed: summaries.reduce((sum, item) => sum + (item.counts?.passed ?? 0), 0),
    failed: summaries.reduce((sum, item) => sum + (item.counts?.failed ?? 0), 0),
    skipped: summaries.reduce((sum, item) => sum + (item.counts?.skipped ?? 0), 0),
    todo: summaries.reduce((sum, item) => sum + (item.counts?.todo ?? 0), 0)
  }
};
let stableInputs = true;
if (inputFingerprints !== null) {
  try {
    const current = fingerprintTestInputs(files);
    stableInputs = [...inputFingerprints].every(([name, fingerprint]) => current.get(name) === fingerprint);
  } catch { stableInputs = false; }
}
const completeReports = timeline.progress().remaining === 0;
const success = summary.success && stableInputs && completeReports;
if (!completeReports) {
  process.stdout.write(`${formatScriptStatus("FAIL", `RUNNER | ${timeline.progress().remaining} archivos terminaron sin informe recibido`)}\n`);
}
if (!stableInputs) {
  process.stdout.write(`${formatScriptStatus("FAIL", "CACHÉ | Entradas modificadas durante las pruebas; resultados no acreditables")}\n`);
}

if (profile) {
  const totalFileDuration = profile.files.reduce((total, file) => total + file.tiempo_ms, 0);
  const longestFileDuration = Math.max(0, ...profile.files.map((file) => file.tiempo_ms));
  const idealLowerBound = Math.max(longestFileDuration, totalFileDuration / effectiveConcurrency);
  writeFileSync(reportPath, JSON.stringify({
    modo: options.concurrency === undefined ? "predeterminado" : "concurrencia configurada",
    concurrencia: effectiveConcurrency,
    resumen: {
      correcto: success,
      archivos: files.length,
      correctos: summary.counts.passed + cachedCounts.passed,
      fallidos: summary.counts.failed,
      omitidos: summary.counts.skipped,
      pendientes: summary.counts.todo,
      tiempo_ms: summary.duration_ms,
      cache: { reutilizados: cachedFiles.length, ejecutados: executableFiles.length, tests_reutilizados: cachedCounts.passed }
    },
    distribucion: lanes.map(({ name, files: assigned, concurrency }) => ({ cola: name, archivos: assigned.length, concurrencia: concurrency })),
    observabilidad: {
      ultimo_inicio_ms: timelineMetrics.last_start_ms,
      ultimo_informe_ms: timelineMetrics.last_report_ms,
      ultima_cola_finalizada_ms: timelineMetrics.last_lane_finished_ms,
      colas: timelineMetrics.lanes,
      muestras: timelineMetrics.snapshots.map((sample) => ({
        ...sample,
        oldest_without_report: sample.oldest_without_report.map(({ file, elapsed_ms }) => ({
          archivo: relative(process.cwd(), file), tiempo_sin_informe_ms: elapsed_ms
        }))
      })),
      estado_final: timelineMetrics.final_progress,
      nota: "Los tiempos de finalización de archivos calculados a partir de duración e inicio son estimaciones. La recepción tardía de un informe no demuestra trabajo activo ni espera de cierre."
    },
    diagnostico: {
      tiempo_acumulado_archivos_ms: totalFileDuration,
      archivo_mas_lento_ms: longestFileDuration,
      cota_inferior_ideal_ms: idealLowerBound,
      diferencia_cota_ideal_ms: Math.max(0, summary.duration_ms - idealLowerBound),
      ultimo_fin_estimado_ms: Math.max(0, ...profile.files.map((file) => file.fin_ms ?? 0)),
      maximo_retraso_informe_ms: Math.max(0, ...profile.files.map((file) => file.retraso_informe_ms ?? 0))
    },
    archivos: profile.files,
    pruebas: profile.tests
  }, null, 2));
}

for (const failure of errors) {
  const location = failure.file ? ` (${failure.file}${failure.line ? `:${failure.line}` : ""})` : "";
  const output = failure.fileFailure ? standardErrors.get(resolve(failure.file))?.trim() : "";
  const reason = output || describeError(failure.error) || "La prueba falló sin diagnóstico adicional";
  process.stdout.write(`${formatScriptStatus("FAIL", `${failure.name}${location}`)}\n${reason}\n`);
}

if (skippedTests.length > 0) {
  process.stdout.write(`OMITIDOS | ${skippedTests.length}\n`);
  for (const skipped of skippedTests) process.stdout.write(formatRunnerOmission(skipped));
}

if (todoTests.length > 0) {
  process.stdout.write(`TODO | ${todoTests.length}\n`);
  for (const todo of todoTests) process.stdout.write(formatRunnerOmission(todo));
}

const { counts: executedCounts, duration_ms: duration } = summary;
const finalCounts = {
  passed: executedCounts.passed + cachedCounts.passed,
  failed: executedCounts.failed,
  skipped: executedCounts.skipped,
  todo: executedCounts.todo
};
if (automaticCache) {
  process.stdout.write(`${formatScriptStatus(success ? "PASS" : "WARN", `CACHÉ | ${cachedFiles.length} suites y ${cachedCounts.passed} tests reutilizados | ${executableFiles.length} suites ejecutadas`)}\n`);
}
if (success && inputFingerprints) {
  try {
    saveTestResultsCache(inputFingerprints, resultsForCache);
  } catch (error) {
    process.stdout.write(`${formatScriptStatus("WARN", `CACHÉ | No se pudo guardar: ${error instanceof Error ? error.message : String(error)}`)}\n`);
  }
} else if (automaticCache && !success) {
  try { discardTestResultsCache(); } catch (error) {
    process.stdout.write(`${formatScriptStatus("WARN", `CACHÉ | No se pudo invalidar: ${error instanceof Error ? error.message : String(error)}`)}\n`);
  }
}
if (success && cachedFiles.length === 0 && durations.length === files.length && durations.length > 0) {
  const regressions = durationRegressions(durations, previousDurations);
  if (regressions.length > 0) {
    process.stdout.write(`${formatScriptStatus("WARN", `RENDIMIENTO | ${regressions.length} archivos duplicaron su duración y aumentaron al menos 10 s`)}\n`);
    for (const item of regressions.slice(0, 5)) {
      const previous = previousDurations?.get(relative(process.cwd(), item.file).replaceAll("\\", "/"));
      process.stdout.write(formatRunnerRegression({
        file: relative(process.cwd(), item.file), before: previous ?? 0, after: item.milliseconds
      }, interactive ? process.stdout.columns || 100 : 120));
    }
  }
  try {
    saveTestDurations(effectiveConcurrency, durations);
  } catch (error) {
    process.stdout.write(`${formatScriptStatus("WARN", `RENDIMIENTO | No se pudo guardar el perfil local: ${error instanceof Error ? error.message : String(error)}`)}\n`);
  }
}
const finishedLanes = timelineMetrics.lanes.map((lane) => `${lane.name} ${lane.reported}/${lane.files} informes (${formatRunnerTime(lane.finished_ms ?? duration)})`).join(" · ");
if (finishedLanes) process.stdout.write(`COLAS | ${finishedLanes}\n`);
if (executableFiles.length === 0) {
  process.stdout.write(`TIEMPOS | Sin ejecución (caché completa) | Total ${formatRunnerTime(duration)}\n`);
} else {
  const lastReportTime = timelineMetrics.last_report_ms;
  process.stdout.write(`TIEMPOS | Último informe ${lastReportTime === null ? "no recibido" : formatRunnerTime(lastReportTime)} | Fin del runner ${formatRunnerTime(duration)} | Intervalo posterior ${lastReportTime === null ? "no calculable" : formatRunnerTime(Math.max(0, duration - lastReportTime))}\n`);
}
if (interactive) {
  for (const line of formatRunnerCompletion({
    success, progress: timelineMetrics.final_progress, counts: finalCounts,
    lanes: timelineMetrics.lanes, cachedTests: cachedCounts.passed, elapsed_ms: duration,
    slowest: durations.reduce((highest, current) => !highest || current.milliseconds > highest.milliseconds ? current : highest, null)
  }, process.stdout.columns || 100, process.env.NO_COLOR === undefined)) {
    process.stdout.write(`${line}\n`);
  }
}
process.stdout.write(`${formatScriptStatus(success ? "PASS" : "FAIL", `${completedFiles.size}/${files.length} archivos | ${finalCounts.passed} correctos${cachedFiles.length ? ` (${cachedCounts.passed} reutilizados)` : ""} | ${finalCounts.failed} fallidos | ${finalCounts.skipped} omitidos | ${Math.round(duration)} ms`)}\n`);
if (!success) process.exitCode = 1;

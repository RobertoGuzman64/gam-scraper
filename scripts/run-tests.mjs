import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join, relative, resolve } from "node:path";
import { clearLine, cursorTo } from "node:readline";
import { run } from "node:test";
import { formatScriptStatus } from "./terminal.mjs";
import { durationRegressions, loadTestDurations, orderTestsByDuration, planTestLanes, recommendedTestConcurrency, saveTestDurations } from "./test-performance.mjs";
import { discardTestResultsCache, fingerprintTestInputs, loadTestResultsCache, relativeCacheFile, saveTestResultsCache } from "./test-result-cache.mjs";

const parseOptions = (argumentsList) => {
  let concurrency;
  let report;

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

    throw new Error(`Opción de pruebas desconocida: ${argument}`);
  }

  return { concurrency, report };
};

const PRIORITIZED_TESTS = [
  "pipeline/publication/tests/individual-finish.test.js",
  "pipeline/publication/tests/individual-accreditation-session.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/delivery-recovery.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/delivery-retention.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/delivery.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/finalization-interventions.test.js",
  "pipeline/campaign/tests/finalization-and-delivery/finalization-recovery.test.js",
  "cli/commands/catalog/tests/catalog-content-gaps-comparison.test.js",
  "pipeline/campaign/tests/reference/reference-update.test.js",
  "pipeline/campaign/tests/operations/operations-status.test.js",
  "pipeline/publication/tests/individual-editorial.test.js",
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
const lanes = planTestLanes(executableFiles, effectiveConcurrency, previousDurations, PRIORITIZED_TESTS.slice(0, 8));
const cachedCounts = { passed: 0, failed: 0, skipped: 0, todo: 0 };
for (const file of cachedFiles) {
  const value = cachedResults.get(relativeCacheFile(file));
  cachedCounts.passed += value.passed;
}
const filePaths = new Set(executableFiles.map((file) => resolve(file)));
const interactive = process.stdout.isTTY === true && process.env.CI !== "true" && process.env.TERM !== "dumb";
const completedFiles = new Set(cachedFiles.map((file) => resolve(file)));
const startedFiles = new Set();
const startedAt = performance.now();
const frames = ["|", "/", "-", "\\"];
let frameIndex = 0;
const errors = [];
const skippedTests = [];
const todoTests = [];
const standardErrors = new Map();
const counts = { ...cachedCounts };
const resultsForCache = new Map(cachedResults);
const profile = options.report ? { tests: [], files: [] } : null;
const profileStarts = profile ? new Map() : null;
const durations = [];

const clearProgress = () => {
  if (!interactive) return;
  cursorTo(process.stdout, 0);
  clearLine(process.stdout, 0);
};

const renderProgress = () => {
  if (!interactive) return;

  const started = startedFiles.size;
  const completed = completedFiles.size;
  const elapsed = Math.floor((performance.now() - startedAt) / 1000);
  const frame = frames[frameIndex % frames.length];
  frameIndex += 1;
  const pending = Math.max(0, started - completed);
  const result = `${started}/${files.length} iniciados | ${completed} informados | ${pending} pendientes | OK ${counts.passed} | KO ${counts.failed} | ${elapsed}s`;
  const omissions = counts.skipped || counts.todo
    ? ` | omit ${counts.skipped}${counts.todo ? ` | TODO ${counts.todo}` : ""}`
    : "";
  const columns = process.stdout.columns > 0 ? process.stdout.columns : 100;
  const available = columns - result.length - omissions.length - 12;
  const barWidth = available >= 8 ? Math.min(20, available) : 0;
  const filled = Math.round((completed / files.length) * barWidth);
  const bar = barWidth ? ` [${"█".repeat(filled)}${"░".repeat(barWidth - filled)}]` : "";

  clearProgress();
  process.stdout.write(`TESTS ${frame}${bar} ${result}${omissions}`);
};

const describeError = (error) => {
  if (typeof error === "string") return error === "test failed" ? "" : error;
  if (error && typeof error.stack === "string") return error.stack;
  if (error && typeof error.message === "string") return error.message;
  return "";
};

const describeOmission = ({ name, file, line, reason }) => {
  const location = file ? ` (${relative(process.cwd(), file)}${line ? `:${line}` : ""})` : "";
  const explanation = typeof reason === "string" && reason.trim() ? reason.trim() : "motivo no indicado";
  return `  - ${name}${location} | ${explanation}\n`;
};

const summaries = [];
renderProgress();
let lastPeriodicReport = 0;
const renderMeasuredProgress = () => {
  if (interactive || !profile) return;
  const elapsed = Math.floor((performance.now() - startedAt) / 1000);
  if (elapsed - lastPeriodicReport < 10) return;
  lastPeriodicReport = elapsed;
  process.stdout.write(`TESTS | ${startedFiles.size} iniciados | ${completedFiles.size}/${files.length} informados | ${counts.passed} correctos | ${counts.failed} fallidos | ${elapsed}s transcurridos\n`);
};
const progressTimer = interactive || profile
  ? setInterval(interactive ? renderProgress : renderMeasuredProgress, interactive ? 350 : 1000)
  : undefined;

const consumeEvent = (event) => {
  if (event.type === "test:dequeue" && typeof event.data.name === "string" && filePaths.has(resolve(event.data.name))) {
    const file = resolve(event.data.name);
    startedFiles.add(file);
    if (profileStarts && !profileStarts.has(file)) profileStarts.set(file, performance.now() - startedAt);
    renderProgress();
  }

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
    const inicio = profileStarts?.get(resolve(event.data.file)) ?? null;
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
      if (fileFailure) {
        completedFiles.add(resolve(name));
      }
    }
  }

  if (event.type === "test:summary") {
    if (event.data.file) {
      completedFiles.add(resolve(event.data.file));
    } else summaries.push(event.data);
  }

  if (event.type === "test:summary" && event.data.file) renderProgress();
  if (event.type === "test:fail" && filePaths.has(resolve(event.data.name))) renderProgress();
};
try {
  await Promise.all(lanes.map(async (lane) => {
    for await (const event of run({ files: lane.files, concurrency: lane.concurrency })) consumeEvent(event);
  }));
} finally {
  if (progressTimer) clearInterval(progressTimer);
  clearProgress();
}
if (summaries.length !== lanes.length) throw new Error("La ejecución de pruebas terminó sin todos los resúmenes");
const elapsedDuration = performance.now() - startedAt;
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
const success = summary.success && stableInputs;
if (!stableInputs) {
  process.stdout.write(`${formatScriptStatus("FAIL", "CACHÉ | Entradas modificadas durante las pruebas; resultados no acreditables")}\n`);
}

if (profile) {
  const totalFileDuration = profile.files.reduce((total, file) => total + file.tiempo_ms, 0);
  const longestFileDuration = Math.max(0, ...profile.files.map((file) => file.tiempo_ms));
  const idealLowerBound = Math.max(longestFileDuration, totalFileDuration / effectiveConcurrency);
  writeFileSync(options.report, JSON.stringify({
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
  for (const skipped of skippedTests) process.stdout.write(describeOmission(skipped));
}

if (todoTests.length > 0) {
  process.stdout.write(`TODO | ${todoTests.length}\n`);
  for (const todo of todoTests) process.stdout.write(describeOmission(todo));
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
process.stdout.write(`${formatScriptStatus(success ? "PASS" : "FAIL", `${completedFiles.size}/${files.length} archivos | ${finalCounts.passed} correctos${cachedFiles.length ? ` (${cachedCounts.passed} reutilizados)` : ""} | ${finalCounts.failed} fallidos | ${finalCounts.skipped} omitidos | ${Math.round(duration)} ms`)}\n`);
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
      process.stdout.write(`  ${relative(process.cwd(), item.file)} | ${Math.round(previous ?? 0)} -> ${Math.round(item.milliseconds)} ms\n`);
    }
  }
  try {
    saveTestDurations(effectiveConcurrency, durations);
  } catch (error) {
    process.stdout.write(`${formatScriptStatus("WARN", `RENDIMIENTO | No se pudo guardar el perfil local: ${error instanceof Error ? error.message : String(error)}`)}\n`);
  }
}
if (!success) process.exitCode = 1;

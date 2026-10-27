import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { clearLine, cursorTo } from "node:readline";
import { run } from "node:test";
import { formatScriptStatus } from "./terminal.mjs";

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

const DEFAULT_CONCURRENCY = 6;
const options = parseOptions(process.argv.slice(2));
const effectiveConcurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

const collectTests = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return collectTests(path);
  return entry.isFile() && entry.name.endsWith(".test.ts") ? [path] : [];
});

const sources = collectTests("src").sort();
if (sources.length === 0) throw new Error("No se encontraron pruebas en src");
const files = sources.map((source) => join("dist", relative("src", source).replace(/\.test\.ts$/, ".test.js")));
const missing = files.filter((file) => !existsSync(file));
if (missing.length > 0) throw new Error(`Faltan ${missing.length} pruebas compiladas: ${missing.join(", ")}`);

const filePaths = new Set(files.map((file) => resolve(file)));
const interactive = process.stdout.isTTY === true && process.env.CI !== "true" && process.env.TERM !== "dumb";
const completedFiles = new Set();
const errors = [];
const skippedTests = [];
const todoTests = [];
const standardErrors = new Map();
const counts = { passed: 0, failed: 0, skipped: 0, todo: 0 };
const profile = options.report ? { tests: [], files: [] } : null;

const clearProgress = () => {
  if (!interactive) return;
  cursorTo(process.stdout, 0);
  clearLine(process.stdout, 0);
};

const renderProgress = () => {
  if (!interactive) return;

  const completed = completedFiles.size;
  const barWidth = Math.max(8, Math.min(20, (process.stdout.columns ?? 100) - 70));
  const filled = Math.round((completed / files.length) * barWidth);
  const bar = `${"█".repeat(filled)}${"░".repeat(barWidth - filled)}`;
  const line = `TESTS [${bar}] ${completed}/${files.length} archivos | ${files.length - completed} pendientes | OK ${counts.passed} | KO ${counts.failed} | omit ${counts.skipped}${counts.todo ? ` | TODO ${counts.todo}` : ""}`;

  clearProgress();
  process.stdout.write(line);
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

let summary;
renderProgress();

for await (const event of run({ files, concurrency: effectiveConcurrency })) {
  if (profile && (event.type === "test:pass" || event.type === "test:fail") && event.data.details?.type === "test") {
    profile.tests.push({
      archivo: event.data.file ? relative(process.cwd(), event.data.file) : "",
      prueba: event.data.name,
      tiempo_ms: event.data.details.duration_ms ?? 0,
      estado: event.type === "test:fail" ? "fallido" : event.data.skip ? "omitido" : event.data.todo ? "todo" : "correcto"
    });
  }

  if (profile && event.type === "test:summary" && event.data.file) {
    profile.files.push({
      archivo: relative(process.cwd(), event.data.file),
      tiempo_ms: event.data.duration_ms ?? 0,
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
      if (fileFailure) completedFiles.add(resolve(name));
    }
  }

  if (event.type === "test:summary") {
    if (event.data.file) completedFiles.add(resolve(event.data.file));
    else summary = event.data;
  }

  if (event.type === "test:summary" && event.data.file) renderProgress();
  if (event.type === "test:fail" && filePaths.has(resolve(event.data.name))) renderProgress();
}

clearProgress();
if (!summary) throw new Error("La ejecución de pruebas terminó sin resumen");

if (profile) {
  writeFileSync(options.report, JSON.stringify({
    modo: options.concurrency === undefined ? "predeterminado" : "concurrencia configurada",
    concurrencia: effectiveConcurrency,
    resumen: {
      correcto: summary.success,
      archivos: files.length,
      correctos: summary.counts.passed,
      fallidos: summary.counts.failed,
      omitidos: summary.counts.skipped,
      pendientes: summary.counts.todo,
      tiempo_ms: summary.duration_ms
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

const { counts: finalCounts, duration_ms: duration } = summary;
process.stdout.write(`${formatScriptStatus(summary.success ? "PASS" : "FAIL", `${completedFiles.size}/${files.length} archivos | ${finalCounts.passed} correctos | ${finalCounts.failed} fallidos | ${finalCounts.skipped} omitidos | ${Math.round(duration)} ms`)}\n`);
if (!summary.success) process.exitCode = 1;

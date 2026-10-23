import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { clearLine, cursorTo } from "node:readline";
import { run } from "node:test";

const collectTests = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return collectTests(path);
  return entry.isFile() && entry.name.endsWith(".test.js") ? [path] : [];
});

const files = collectTests("dist").sort();
if (files.length === 0) throw new Error("No se encontraron pruebas compiladas en dist");

const filePaths = new Set(files.map((file) => resolve(file)));
const interactive = process.stdout.isTTY === true;
const completedFiles = new Set();
const errors = [];
const skippedTests = [];
const todoTests = [];
const standardErrors = new Map();
const counts = { passed: 0, failed: 0, skipped: 0, todo: 0 };

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

for await (const event of run({ files })) {
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

for (const failure of errors) {
  const location = failure.file ? ` (${failure.file}${failure.line ? `:${failure.line}` : ""})` : "";
  const output = failure.fileFailure ? standardErrors.get(resolve(failure.file))?.trim() : "";
  const reason = output || describeError(failure.error) || "La prueba falló sin diagnóstico adicional";
  process.stdout.write(`FALLO: ${failure.name}${location}\n${reason}\n`);
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
const result = summary.success ? "OK" : "FALLO";
process.stdout.write(`${result} | ${completedFiles.size}/${files.length} archivos | ${finalCounts.passed} correctos | ${finalCounts.failed} fallidos | ${finalCounts.skipped} omitidos | ${Math.round(duration)} ms\n`);
if (!summary.success) process.exitCode = 1;

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { run } from "node:test";

const collectTests = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return collectTests(path);
  return entry.isFile() && entry.name.endsWith(".test.js") ? [path] : [];
});

const files = collectTests("dist").sort();
if (files.length === 0) throw new Error("No se encontraron pruebas compiladas en dist");

let hasSummary = false;
for await (const event of run({ files })) {
  if (event.type === "test:fail") {
    const { name, file, line, details } = event.data;
    const error = details?.error?.cause ?? details?.error;
    const location = file ? ` (${file}${line ? `:${line}` : ""})` : "";
    const reason = error?.stack ?? error?.message ?? "Error sin detalle";
    process.stdout.write(`FALLO: ${name}${location}\n${reason}\n`);
  }

  if (event.type === "test:summary" && !event.data.file) {
    hasSummary = true;
    const { counts, duration_ms } = event.data;
    const result = event.data.success ? "OK" : "FALLO";
    process.stdout.write(`${result} | ${counts.passed} correctos | ${counts.failed} fallidos | ${counts.skipped} omitidos | ${Math.round(duration_ms)} ms\n`);
    if (!event.data.success) process.exitCode = 1;
  }
}

if (!hasSummary) throw new Error("La ejecución de pruebas terminó sin resumen");

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runAuditBattery } from "./audit-battery-core.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
let outDirectory;
let timeoutMs = 240_000;
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--salida" && args[index + 1]) outDirectory = resolve(args[++index]);
  else if (arg === "--timeout-ms" && /^[1-9]\d*$/u.test(args[index + 1] ?? "")) timeoutMs = Number(args[++index]);
  else {
    console.error(`Argumento no válido: ${arg}. Uso: node scripts/inspection/audit-battery.mjs [--salida DIRECTORIO] [--timeout-ms MILISEGUNDOS]`);
    process.exit(1);
  }
}
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000) {
  console.error("--timeout-ms debe ser un entero de al menos 1000");
  process.exit(1);
}
try {
  const { output, report } = await runAuditBattery({ root, outDirectory, timeoutMs });
  console.log(`AUDITORÍAS | ${report.status} | ${report.audits.length}/11 | ${output}`);
  for (const item of report.audits) console.log(`  ${item.id} | ${item.status} | código ${item.exitCode ?? "—"} | ${item.durationMs} ms`);
  process.exitCode = report.status === "SUCCESS" ? 0 : 1;
} catch (error) {
  console.error(`AUDITORÍAS | ERROR | ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCoverageReview } from "../catalog/coverage/review.js";
import { readCanonicalCatalog } from "../infrastructure/filesystem/canonical-catalog.js";
import { printCommandError } from "./reporting/errors.js";

const help = `Uso:
  npm run review:coverage -- --baseline <catalog.json> --current <catalog.json> --out <revision.json>
  npm run review:coverage -- --baseline <catalog.json> --current <catalog.json> --dry-run

Genera un informe con todas las ausencias y cambios de campos. Las decisiones se dejan
pendientes: cada retiro o cambio requiere motivo y URL de evidencia antes de publicar.`;

export const runReviewCoverage = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") { console.log(help); return; }
  const paths = new Map<string, string>();
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--dry-run") {
      if (dryRun) throw new Error("--dry-run repetido");
      dryRun = true;
      continue;
    }
    if (!key || !["--baseline", "--current", "--out"].includes(key)) throw new Error(`Opción desconocida: ${key}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--") || paths.has(key)) throw new Error(`Opción sin valor o repetida: ${key}`);
    paths.set(key, resolve(value));
    index += 1;
  }
  const baseline = paths.get("--baseline");
  const current = paths.get("--current");
  const out = paths.get("--out");
  if (!baseline || !current || baseline === current || (dryRun ? Boolean(out) : !out)) {
    throw new Error("Indicar dos fuentes distintas y --out, o --dry-run sin --out");
  }
  if ((out && (out === baseline || out === current || !out.endsWith(".json")))) {
    throw new Error("Salida inválida");
  }
  const [previous, next, rawPrevious, rawNext] = await Promise.all([
    readCanonicalCatalog(baseline), readCanonicalCatalog(current), readFile(baseline, "utf8"), readFile(current, "utf8")
  ]);
  const sha = (raw: string): string => createHash("sha256").update(raw).digest("hex");
  const report = createCoverageReview(previous, next, sha(rawPrevious), sha(rawNext));
  console.log(`REVISIÓN DE COBERTURA | ausentes ${report.missing.length} | cambiadas ${report.changed.length}`);
  for (const item of report.missing) console.log(`  AUSENTE | ${item.reference} | ${item.url}`);
  for (const item of report.changed) console.log(`  CAMBIADA | ${item.reference} | ${item.fields.join(", ")}`);
  if (dryRun) { console.log("Simulación: ningún archivo escrito"); return; }
  if (!out) throw new Error("Falta --out");
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(`  Informe para decisión editorial: ${out}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runReviewCoverage(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("review:coverage", error);
    process.exitCode = 1;
  });
}

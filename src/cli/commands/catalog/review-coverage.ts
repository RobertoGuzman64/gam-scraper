import { printReportLine } from "../../reporting/terminal.js";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCoverageReview } from "../../../catalog/coverage/review.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { printCommandError } from "../../reporting/errors.js";

const help = `Uso:
  npm run cobertura -- --baseline <catalog.json> --current <catalog.json> --out <revision.json>
  npm run cobertura -- --baseline <catalog.json> --current <catalog.json> --dry-run

Genera un informe con todas las ausencias y cambios de campos. Las decisiones se dejan
pendientes: una retirada debe acreditarse; una ausencia de listado acreditada
requiere además una URL de categoría oficial del mismo ámbito. "no_acreditado"
registra la incertidumbre pero bloquea la publicación, igual que una decisión nula.
Los cambios requieren aceptación justificada y URL de evidencia antes de publicar.
Las galerías y descripciones modificadas exigen también revisión individual
de sus campos con evidencia, sin aprobar automáticamente la nueva extracción.`;

export const runReviewCoverage = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") { printReportLine(help); return; }
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
  printReportLine(`REVISIÓN DE COBERTURA | ausentes ${report.missing.length} | cambiadas ${report.changed.length}`);
  for (const item of report.missing) printReportLine(`  AUSENTE | ${item.reference} | ${item.url}`);
  for (const item of report.changed) {
    printReportLine(`  CAMBIADA | ${item.reference} | ${item.fields.join(", ")}`);
    const gallery = item.audit.images;
    if (gallery) {
      printReportLine(`    GALERÍA | ${gallery.previousCount} -> ${gallery.currentCount} | principal conservada: ${gallery.primaryRetained} | eliminadas: ${gallery.removed.length} | añadidas: ${gallery.added.length}`);
    }
    for (const description of item.audit.descriptions) {
      printReportLine(`    ${description.field} | ${description.previousLength} -> ${description.currentLength} caracteres`);
    }
    for (const field of item.audit.otherFields) {
      printReportLine(`    ${field.field} | ${JSON.stringify(field.previousValue)} -> ${JSON.stringify(field.currentValue)}`);
    }
    if (item.fieldChecks.length) printReportLine(`    Revisiones de campo pendientes: ${item.fieldChecks.map(({ field }) => field).join(", ")}`);
  }
  if (dryRun) { printReportLine("Simulación: ningún archivo escrito"); return; }
  if (!out) throw new Error("Falta --out");
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(report, null, 2), { flag: "wx" });
  printReportLine(`  Informe para decisión editorial: ${out}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runReviewCoverage(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("review:coverage", error);
    process.exitCode = 1;
  });
}

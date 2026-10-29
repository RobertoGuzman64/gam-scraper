import { printReportLine } from "../../reporting/terminal.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareSavedCatalog } from "../../../pipeline/preparation/prepare.js";
import { parsePrepareOptions, prepareHelp } from "../../options/prepare.js";
import { formatPriceAvailability } from "../../reporting/review-diagnostics.js";
import { formatImportDiagnostics } from "../../reporting/import-diagnostics.js";
import { printCommandError } from "../../reporting/errors.js";

export const runPrepare = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine(prepareHelp);
    return;
  }
  if (args.includes("--help")) throw new Error("--help no admite argumentos adicionales");
  const options = parsePrepareOptions(args);
  const result = await prepareSavedCatalog(options);
  const totals = result.diagnostics.totals;
  printReportLine(`PREPARACIÓN | ${options.providerId.toUpperCase()} | ${options.dryRun ? "SIMULACIÓN" : "GUARDADA"}`);
  printReportLine(`  Productos: ${totals.products} | Calidad ready: ${totals.ready} | Calidad review: ${totals.review}`);
  printReportLine(formatPriceAvailability(result.preparation.products));
  for (const line of formatImportDiagnostics(result.preparation.products)) printReportLine(line);
  printReportLine(`  Incidencias de calidad: ${totals.incidences} | 1 motivo: ${totals.reviewSingle} | múltiples: ${totals.reviewMultiple}`);
  for (const [condition, counts] of Object.entries(result.diagnostics.conditions)) {
    printReportLine(`  ${condition}: ${counts.ready + counts.review} | ready: ${counts.ready} | review: ${counts.review}`);
  }
  if (result.diagnostics.sourceTriage) {
    const actionable = result.diagnostics.sourceTriage.filter((entry) =>
      entry.signal === "especificacion_explicita" || entry.signal === "campo_origen_no_validado" || entry.signal === "mencion_textual");
    const counts = actionable.reduce((sum, entry) => sum + entry.affected, 0);
    printReportLine(`  Contraste de origen: ${counts} incidencias con indicios locales, sin recuperación acreditada`);
    for (const entry of actionable.slice().sort((a, b) => b.affected - a.affected).slice(0, 5)) {
      printReportLine(`    ${entry.issueCode} | ${entry.categoryKey} | ${entry.signal}: ${entry.affected} | refs: ${entry.examples.join(", ")}`);
    }
  }
  if (result.comparison) {
    if (!result.comparison.comparable) printReportLine(`  Comparación NO homogénea: ${result.comparison.reason}`);
    else printReportLine(`  Comparación: review→ready ${result.comparison.reviewToReady.length} | ready→review ${result.comparison.readyToReview.length} | categorías ${result.comparison.categoryChanged.length} | atributos ${result.comparison.attributesChanged.length}`);
    printReportLine(`  Reglas diferentes: ${result.comparison.rulesChanged ? "sí" : "no"} | Snapshots diferentes: ${result.comparison.snapshotsChanged ? "sí" : "no"}`);
  }
  if (options.dryRun) printReportLine("  Sin archivos escritos; la ejecución no consulta portales");
  else printReportLine(`  Preparación: ${result.preparationFile}\n  Diagnósticos: ${result.diagnosticsFile}\n  Manifest: ${result.manifestFile}${result.comparisonFile ? `\n  Comparación: ${result.comparisonFile}` : ""}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPrepare(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("prepare", error);
    process.exitCode = 1;
  });
}

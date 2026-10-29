import { printReportLine } from "../../reporting/terminal.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareSavedCatalog } from "../../../pipeline/preparation/prepare.js";
import { interventionPreparationHelp, parseInterventionPreparationOptions } from "../../options/intervention-preparation.js";
import { printCommandError } from "../../reporting/errors.js";

export const runPrepareIntervention = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine(interventionPreparationHelp);
    return;
  }
  const options = parseInterventionPreparationOptions(args);
  const result = await prepareSavedCatalog({
    ...options, compare: null
  });
  printReportLine([
    `PREPARACIÓN INTERVENIDA | ${options.providerId.toUpperCase()} | ${options.dryRun ? "SIMULACIÓN" : "GUARDADA"}`,
    `  Productos: ${result.preparation.source.productCount} | Ready: ${result.preparation.totals.ready} | Review: ${result.preparation.totals.review}`,
    `  SHA original: ${result.preparation.source.intervention?.sourceCatalogSha256 ?? ""}`,
    `  SHA derivado: ${result.preparation.source.catalogSha256}`,
    `  SHA plan: ${result.preparation.source.intervention?.planSha256 ?? ""}`,
    `  Salida: ${result.preparationFile}`,
    "  Estado: no publicable automáticamente; conserva las revisiones editoriales"
  ].join("\n"));
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPrepareIntervention(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("intervenir:preparar", error);
    process.exitCode = 1;
  });
}

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateOfflinePreparation } from "../pipeline/validation/offline.js";
import { interventionPreparationHelp, parseInterventionValidationOptions } from "./options/intervention-preparation.js";
import { printCommandError } from "./reporting/errors.js";

export const runValidateIntervention = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log(interventionPreparationHelp);
    return;
  }
  const options = parseInterventionValidationOptions(args);
  const result = await validateOfflinePreparation(
    options.providerId, options.preparation, options.source, null, options.originalSource
  );
  console.log([
    `VALIDACIÓN INTERVENIDA | ${options.providerId.toUpperCase()} | ${result.importBlocked ? "REVISIÓN" : "CONFORME"}`,
    `  Productos: ${result.catalog.productCount} | Ready: ${result.ready} | Review: ${result.review}`,
    `  Importables: ${result.importReady} | Bloqueados: ${result.importBlocked}`,
    `  SHA derivado: ${result.catalog.catalogSha256}`,
    `  SHA plan: ${result.preparation.source.intervention?.planSha256 ?? ""}`,
    "  Estado: procedencia verificada; sin aprobación editorial automática"
  ].join("\n"));
  if (result.importBlocked > 0) process.exitCode = 2;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runValidateIntervention(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("intervenir:validar", error);
    process.exitCode = 1;
  });
}

import { readFile } from "node:fs/promises";
import { LiveStatus, formatDuration } from "./reporting/live-status.js";
import { formatReviewDiagnostics } from "./reporting/review-diagnostics.js";
import { parsePreparation } from "../catalog/import/preparation/preparation-document.js";
import { printCommandError } from "./reporting/errors.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseValidateOptions, validateHelp } from "./options/validate.js";
export { validateHelp } from "./options/validate.js";
import { validateCatalogPublication } from "../pipeline/validation/preflight.js";

export const runPreflight = async (args: readonly string[]): Promise<void> => {
  if (args.includes("--help")) {
    console.log(validateHelp);
    return;
  }
  const { providerId, outputDir, outputPrefix, maxAgeHours, displayedOutputDir } = parseValidateOptions(args);
  const status = new LiveStatus();
  const startedAt = Date.now();
  status.update(`VALIDACIÓN | ${providerId.toUpperCase()} | comprobando catálogo | ${displayedOutputDir}`);
  let result: Awaited<ReturnType<typeof validateCatalogPublication>>;
  try {
    result = await validateCatalogPublication({
      providerId,
      outputDir,
      outputPrefix,
      maxAgeHours
    });
  } finally {
    status.stop();
  }
  let diagnostics: readonly string[] = [];
  if (result.review > 0) {
    const preparationText = await readFile(resolve(outputDir, `${outputPrefix}-preparation.json`), "utf8");
    const preparation: unknown = JSON.parse(preparationText);
    const products = parsePreparation(preparation, providerId).products;
    if (products.length !== result.productCount || products.filter((entry) => entry.status === "review").length !== result.review) {
      throw new Error("La preparación cambió durante la validación; repetir el comando");
    }
    diagnostics = formatReviewDiagnostics(products);
  }
  console.log(`VALIDACIÓN | ${result.providerId.toUpperCase()} | ${result.status === "passed" ? "CONFORME" : "REVISIÓN"}`);
  console.log(`  Productos: ${result.productCount} | Listos: ${result.ready} | Revisar: ${result.review} | Posibles bajas: ${result.suspectedMissing}`);
  for (const warning of result.warnings) console.log(`  Aviso: ${warning}`);
  for (const line of diagnostics) console.log(line);
  console.log(`  Resumen: ${result.summaryFile} | Duración: ${formatDuration(Date.now() - startedAt)}`);
  if (result.status === "review") process.exitCode = 2;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPreflight(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("validate", error);
    process.exitCode = 1;
  });
}

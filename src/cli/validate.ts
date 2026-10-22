import { readFile } from "node:fs/promises";
import { LiveStatus, formatDuration } from "./reporting/live-status.js";
import { formatReviewDiagnostics } from "./reporting/review-diagnostics.js";
import { parsePreparation } from "../catalog/import/preparation/preparation-document.js";
import { printCommandError } from "./reporting/errors.js";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseValidateOptions, validateHelp } from "./options/validate.js";
export { validateHelp } from "./options/validate.js";
import { validateCatalogPublication } from "../pipeline/validation/preflight.js";
import { validateCanonicalSource, validateOfflinePreparation } from "../pipeline/validation/offline.js";
import { readOfflinePreparation } from "../infrastructure/filesystem/offline-preparation.js";

export const runPreflight = async (args: readonly string[]): Promise<void> => {
  if (args.includes("--help")) {
    console.log(validateHelp);
    return;
  }
  const options = parseValidateOptions(args);
  const { providerId, outputDir, outputPrefix, maxAgeHours, displayedOutputDir } = options;
  const status = new LiveStatus();
  const startedAt = Date.now();
  status.update(`VALIDACIÓN | ${providerId.toUpperCase()} | ${options.stage} | ${displayedOutputDir}`);
  if (options.stage === "catalog") {
    try {
      if (!options.source) throw new Error("Falta catálogo canónico de origen");
      const report = await validateCanonicalSource(options.source, providerId);
      status.stop();
      console.log(`VALIDACIÓN | ${providerId.toUpperCase()} | CATÁLOGO CONFORME`);
      console.log(`  Productos: ${report.productCount} | Origen: ${report.sourceFile}`);
      console.log(`  SHA-256: ${report.catalogSha256} | Duración: ${formatDuration(Date.now() - startedAt)}`);
    } finally { status.stop(); }
    return;
  }
  if (options.stage === "preparation") {
    try {
      if (!options.preparation) throw new Error("Falta --preparation");
      const source = options.source ?? join(outputDir,
        `${(await readOfflinePreparation(options.preparation, providerId)).source.prefix}-catalog.json`);
      const report = await validateOfflinePreparation(providerId, options.preparation, source);
      status.stop();
      console.log(`VALIDACIÓN | ${providerId.toUpperCase()} | ${report.review ? "REVISIÓN" : "CONFORME"}`);
      console.log(`  Productos: ${report.catalog.productCount} | Listos: ${report.ready} | Revisar: ${report.review}`);
      if (report.review > 0) {
        for (const line of formatReviewDiagnostics(report.preparation.products)) console.log(line);
        process.exitCode = 2;
      }
      console.log(`  Preparación: ${report.preparationFile} | Duración: ${formatDuration(Date.now() - startedAt)}`);
    } finally { status.stop(); }
    return;
  }
  let result: Awaited<ReturnType<typeof validateCatalogPublication>>;
  try {
    result = await validateCatalogPublication({ providerId, outputDir, outputPrefix, maxAgeHours });
  } finally { status.stop(); }
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

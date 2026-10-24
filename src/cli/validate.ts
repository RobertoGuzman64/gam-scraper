import { readFile } from "node:fs/promises";
import { LiveStatus, formatDuration } from "./reporting/live-status.js";
import { formatPriceAvailability, formatReviewDiagnostics } from "./reporting/review-diagnostics.js";
import { formatDetailedValidation } from "./reporting/detailed-validation.js";
import { formatImportDiagnostics } from "./reporting/import-diagnostics.js";
import { parsePreparation } from "../catalog/import/preparation/preparation-document.js";
import { printCommandError } from "./reporting/errors.js";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseValidateOptions, validateHelp } from "./options/validate.js";
export { validateHelp } from "./options/validate.js";
import { validateCatalogPublication } from "../pipeline/validation/preflight.js";
import { validateCanonicalSource, validateOfflinePreparation } from "../pipeline/validation/offline.js";
import { readOfflinePreparation } from "../infrastructure/filesystem/offline-preparation.js";
import { readCanonicalCatalog } from "../infrastructure/filesystem/canonical-catalog.js";
import { compareCanonicalCoverage } from "../catalog/coverage/compare.js";

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
      if (options.baseline) {
        const [previous, current] = await Promise.all([
          readCanonicalCatalog(options.baseline), readCanonicalCatalog(options.source)
        ]);
        const delta = compareCanonicalCoverage(previous, current);
        console.log(`COBERTURA | ${providerId.toUpperCase()} | anterior: ${delta.previousCount} | actual: ${delta.currentCount} | ausentes: ${delta.missing.length} | incorporadas: ${delta.added.length} | cambiadas: ${delta.changed}`);
        for (const product of delta.missing) {
          console.log(`  AUSENTE | ${product.reference ?? "sin referencia"} | ${product.title ?? "sin título"} | ${product.url}`);
        }
        for (const product of delta.added) {
          console.log(`  INCORPORADA | ${product.reference ?? "sin referencia"} | ${product.title ?? "sin título"} | ${product.url}`);
        }
        for (const product of delta.changedDetails) {
          console.log(`  CAMBIADA | ${product.reference ?? "sin referencia"} | campos: ${product.fields.join(", ")} | ${product.url}`);
        }
        if (delta.changedDetails.length > 0) {
          console.log("  REVISIÓN DE CAMBIOS | Contrastar los campos modificados antes de publicar");
        }
        if (delta.missing.length > 0 || delta.changedDetails.length > 0) {
          console.log("  REVISIÓN DE COBERTURA | No reincorporar ni dar de baja referencias sin verificar la fuente");
          process.exitCode = 2;
        }
      }
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
      console.log(`VALIDACIÓN | ${providerId.toUpperCase()} | ${report.importBlocked ? "REVISIÓN" : "CONFORME"}`);
      console.log(`  Productos: ${report.catalog.productCount} | Calidad ready: ${report.ready} | Calidad review: ${report.review} | Importables create/many: ${report.importReady} | Bloqueados: ${report.importBlocked}`);
      console.log(formatPriceAvailability(report.preparation.products));
      for (const line of formatImportDiagnostics(report.preparation.products)) console.log(line);
      if (report.review > 0) {
        for (const line of formatReviewDiagnostics(report.preparation.products)) console.log(line);
      }
      if (report.importBlocked > 0) process.exitCode = 2;
      if (options.verbose) {
        for (const line of formatDetailedValidation(report.preparation.products)) console.log(line);
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
  let preparedProducts: ReturnType<typeof parsePreparation>["products"] | null = null;
  if (result.review > 0 || result.importBlocked > 0 || options.verbose) {
    const preparationText = await readFile(resolve(outputDir, `${outputPrefix}-preparation.json`), "utf8");
    const preparation: unknown = JSON.parse(preparationText);
    const products = parsePreparation(preparation, providerId).products;
    if (products.length !== result.productCount || products.filter((entry) => entry.status === "review").length !== result.review) {
      throw new Error("La preparación cambió durante la validación; repetir el comando");
    }
    diagnostics = [...formatReviewDiagnostics(products), ...formatImportDiagnostics(products)];
    if (options.verbose) preparedProducts = products;
  }
  console.log(`VALIDACIÓN | ${result.providerId.toUpperCase()} | ${result.status === "passed" ? "CONFORME" : "REVISIÓN"}`);
  console.log(`  Productos: ${result.productCount} | Calidad ready: ${result.ready} | Calidad review: ${result.review} | Importables create/many: ${result.importReady} | Bloqueados: ${result.importBlocked} | Posibles bajas: ${result.suspectedMissing}`);
  for (const warning of result.warnings) console.log(`  Aviso: ${warning}`);
  for (const line of diagnostics) console.log(line);
  if (options.verbose) {
    if (!preparedProducts) {
      const preparationText = await readFile(resolve(outputDir, `${outputPrefix}-preparation.json`), "utf8");
      const preparation: unknown = JSON.parse(preparationText);
      preparedProducts = parsePreparation(preparation, providerId).products;
    }
    for (const line of formatDetailedValidation(preparedProducts)) console.log(line);
  }
  console.log(`  Resumen: ${result.summaryFile} | Duración: ${formatDuration(Date.now() - startedAt)}`);
  if (result.status === "review") process.exitCode = 2;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPreflight(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("validate", error);
    process.exitCode = 1;
  });
}

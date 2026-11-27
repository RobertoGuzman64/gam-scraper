import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIndividualCatalogProviders } from "../../../options/individual-catalog.js";
import { prepareIndividualCatalogs } from "../../../../preparation/workflow/individual-prepare.js";
import { checkHistoricalReferenceIntegrity } from "../../../../infrastructure/filesystem/legacy-export/reference-integrity.js";
import { formatCommandColumns, printCommandHeader, printCommandProvider, printCommandSection, printCommandResult, printCommandWarning, printCommandDeliverable, printReportLine, printStatus } from "../../../reporting/terminal.js";
import { printCommandError } from "../../../reporting/errors.js";
import { renderHistoricalReferenceMismatches } from "../../../reporting/catalog/historical-references.js";
import { OperationProgress } from "../../../reporting/progress/operation-progress.js";

export const prepareIndividualHelp = `Uso:
  npm run preparar
  npm run preparar -- --proveedor gam
  npm run preparar -- --simular
  npm run preparar -- --proveedor gomariz --simular
  npm run preparar -- --proveedor manain
  npm run preparar -- --detalle

Proveedores por defecto: gam, gomariz, mercaeleva y manain.
--simular consulta y calcula sin escribir nada; --detalle muestra progreso por proveedor, diagnósticos, rutas y referencias históricas.
La preparación de Manain verifica su registro parcial y conserva esa procedencia; FINISH exige su propio preflight y acreditación.
Reutiliza preparaciones verificadas; nunca aprueba, publica, extrae ni altera originales.`;

export const runPrepareIndividual = async (args: readonly string[], workspace: string): Promise<boolean> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine(prepareIndividualHelp);
    return true;
  }
  if (args.includes("--help")) throw new Error("--help no admite otros argumentos");
  const detailed = args.includes("--detalle");
  if (args.filter((arg) => arg === "--detalle").length > 1) throw new Error("--detalle repetido");
  const options = parseIndividualCatalogProviders(args.filter((arg) => arg !== "--detalle"), true, true);
  printCommandHeader("PASO 1/2 · PREPARAR", options.dryRun);
  const progress = new OperationProgress("PREPARAR", detailed);
  let results: Awaited<ReturnType<typeof prepareIndividualCatalogs>>;
  let referenceMismatches: Awaited<ReturnType<typeof checkHistoricalReferenceIntegrity>>;
  try {
    progress.stage("CATÁLOGOS", `${options.providerIds.length} ${options.providerIds.length === 1 ? "proveedor" : "proveedores"}`);
    results = await prepareIndividualCatalogs({
      workspace, providers: options.providerIds, dryRun: options.dryRun,
      onProgress: (providerId, completed, count) => progress.update(providerId.toUpperCase(), completed, count)
    });
    progress.stage("REFERENCIAS HISTÓRICAS", "comprobando integridad");
    referenceMismatches = await checkHistoricalReferenceIntegrity(workspace);
    progress.finish(results.some((result) => !result.summary) ? "WARN" : "PASS");
  } catch (error) {
    progress.abort();
    throw error;
  }
  let total = 0;
  let ready = 0;
  let review = 0;
  let blocked = 0;
  const summaries = formatCommandColumns(results.map(({ summary }) => summary
    ? [`${summary.sourceCount} originales`, `${summary.ready} ready`, `${summary.review} review`] : []));
  printCommandSection("PROVEEDORES");
  for (const [index, result] of results.entries()) {
    if (index > 0) printReportLine("");
    if (!result.summary) {
      blocked += 1;
      printStatus("FAIL", `${result.providerId.toUpperCase()} | BLOQUEADA | ${result.error}`);
      continue;
    }
    const summary = result.summary;
    total += summary.sourceCount;
    ready += summary.ready;
    review += summary.review;
    printCommandProvider(result.providerId, summaries[index] ?? "");
    if (summary.activeAvailable) {
      printReportLine(`    Frente a vigente: altas ${summary.possibleAdds} · ausencias ${summary.possibleRemovals} · cambios ${summary.possibleChanges}`);
      if (summary.possibleSpecificationLosses > 0) {
        printCommandWarning(`${result.providerId.toUpperCase()} | ${summary.possibleSpecificationLosses} pérdidas técnicas sin reconciliar`);
      }
    } else printReportLine(`    Sin publicación individual vigente · ${summary.ready} candidatos`);
    if (summary.reviewReferences.length > 0) {
      printCommandWarning(`${result.providerId.toUpperCase()} | ${summary.reviewReferences.length} referencias review: ${summary.reviewReferences.slice(0, detailed ? summary.reviewReferences.length : 20).join(", ")}${!detailed && summary.reviewReferences.length > 20 ? ` (+${summary.reviewReferences.length - 20})` : ""}`);
    }
    if (summary.incidences > 0 && summary.diagnostics.issues.length === 0) {
      printCommandWarning(`${result.providerId.toUpperCase()} | ${summary.incidences} incidencias de preparación`);
    }
    if (detailed) {
      printReportLine(`    Estado: ${summary.status} · incidencias ${summary.incidences} · transformaciones técnicas contrastadas ${summary.reconciledSpecificationChanges}`);
      printReportLine(`    Ausencias históricas (no exclusiones): ${summary.historicalExclusions.length}`);
      for (const issue of summary.diagnostics.issues) {
        printReportLine(`    ${issue.code}: ${issue.affected} · ${issue.examples.join(", ")}`);
      }
      if (summary.preparationFile) printCommandDeliverable("    Preparación", summary.preparationFile);
    }
  }
  if (referenceMismatches?.length) {
    printReportLine("");
    for (const line of renderHistoricalReferenceMismatches(referenceMismatches, detailed)) printReportLine(line);
  }
  printCommandSection("RESUMEN");
  printReportLine(`${results.length - blocked}/${results.length} proveedores · ${total} originales · ${ready} ready · ${review} review · ${blocked} bloqueados`);
  if (blocked) {
    printCommandResult("PASO 1 BLOQUEADO · Corrige los bloqueos antes de publicar", "FAIL");
    return false;
  }
  printCommandResult(options.dryRun ? "SIMULACIÓN COMPLETA · SIN ESCRITURAS"
    : "PASO 1 COMPLETO · Siguiente: npm run publicar:simular");
  return true;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));
  runPrepareIndividual(process.argv.slice(2), root).then((ok) => {
    if (!ok) process.exitCode = 1;
  }).catch((error: unknown) => {
    printCommandError("preparar", error);
    process.exitCode = 1;
  });
}

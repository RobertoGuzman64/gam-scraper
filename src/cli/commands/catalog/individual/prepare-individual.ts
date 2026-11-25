import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIndividualCatalogProviders } from "../../../options/individual-catalog.js";
import { prepareIndividualCatalogs } from "../../../../preparation/workflow/individual-prepare.js";
import { checkHistoricalReferenceIntegrity } from "../../../../infrastructure/filesystem/legacy-export/reference-integrity.js";
import { printCommandHeader, printCommandProvider, printCommandSection, printCommandResult, printCommandWarning, printCommandDeliverable, printReportLine, printStatus } from "../../../reporting/terminal.js";
import { printCommandError } from "../../../reporting/errors.js";
import { OperationProgress } from "../../../reporting/progress/operation-progress.js";

export const prepareIndividualHelp = `Uso:
  npm run catalogo:preparar
  npm run catalogo:preparar -- --proveedor gam
  npm run catalogo:preparar -- --simular
  npm run catalogo:preparar -- --proveedor gomariz --simular
  npm run catalogo:preparar -- --proveedor manain
  npm run catalogo:preparar -- --detalle

Proveedores por defecto: gam, gomariz y mercaeleva. Manain se prepara solo si se solicita explícitamente.
--simular consulta y calcula sin escribir nada; --detalle muestra diagnósticos, rutas y referencias históricas.
La preparación de Manain verifica su registro parcial y conserva esa procedencia; no habilita FINISH.
Reutiliza preparaciones verificadas; nunca aprueba, publica, extrae ni altera originales.`;

export const runPrepareIndividual = async (args: readonly string[], workspace: string): Promise<boolean> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine(prepareIndividualHelp);
    return true;
  }
  if (args.includes("--help")) throw new Error("--help no admite otros argumentos");
  const detailed = args.includes("--detalle");
  if (args.filter((arg) => arg === "--detalle").length > 1) throw new Error("--detalle repetido");
  const options = parseIndividualCatalogProviders(args.filter((arg) => arg !== "--detalle"), true);
  printCommandHeader("PASO 1/2 · PREPARAR", options.dryRun);
  const progress = new OperationProgress("PREPARAR");
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
  for (const result of results) {
    if (!result.summary) {
      blocked += 1;
      printStatus("FAIL", `${result.providerId.toUpperCase()} | BLOQUEADA | ${result.error}`);
      continue;
    }
    const summary = result.summary;
    total += summary.sourceCount;
    ready += summary.ready;
    review += summary.review;
    printCommandProvider(result.providerId, `${summary.sourceCount} originales · ${summary.ready} ready · ${summary.review} review`);
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
    printCommandSection("REFERENCIAS HISTÓRICAS");
    printCommandWarning(`${referenceMismatches.length} archivos difieren del manifiesto histórico; no se modifican`);
    if (detailed) {
      for (const item of referenceMismatches) printReportLine(`  ${item.path} · SHA-256 actual ${item.actualSha256 ?? "archivo ausente o no regular"}`);
    } else printReportLine("  Usa --detalle para consultar rutas y huellas");
  }
  printCommandSection("RESUMEN");
  printReportLine(`${results.length - blocked}/${results.length} proveedores · ${total} originales · ${ready} ready · ${review} review · ${blocked} bloqueados`);
  if (blocked) {
    printCommandResult("PASO 1 BLOQUEADO · Corrige los bloqueos antes de publicar", "FAIL");
    return false;
  }
  printCommandResult(options.providerIds.includes("manain")
    ? options.dryRun ? "SIMULACIÓN DE MANAIN COMPLETA · SIN ESCRITURAS · FINISH NO HABILITADO"
      : "PREPARACIÓN DE MANAIN GUARDADA · REVISIÓN EDITORIAL PENDIENTE · FINISH NO HABILITADO"
    : options.dryRun ? "SIMULACIÓN COMPLETA · SIN ESCRITURAS"
      : "PASO 1 COMPLETO · Siguiente: npm run catalogo:publicar");
  return true;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));
  runPrepareIndividual(process.argv.slice(2), root).then((ok) => {
    if (!ok) process.exitCode = 1;
  }).catch((error: unknown) => {
    printCommandError("catalogo:preparar", error);
    process.exitCode = 1;
  });
}

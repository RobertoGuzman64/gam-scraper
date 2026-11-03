import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIndividualCatalogProviders } from "../../options/individual-catalog.js";
import { prepareIndividualCatalogs } from "../../../pipeline/preparation/individual-prepare.js";
import { formatHeader, printReportLine, printStatus } from "../../reporting/terminal.js";
import { printCommandError } from "../../reporting/errors.js";

export const prepareIndividualHelp = `Uso:
  npm run catalogo:preparar
  npm run catalogo:preparar -- --proveedor gam
  npm run catalogo:preparar -- --simular
  npm run catalogo:preparar -- --proveedor gomariz --simular

Proveedores por defecto: gam, gomariz y mercaeleva.
--simular consulta y calcula sin escribir nada. Manain es parcial y no entra.
Reutiliza preparaciones verificadas; nunca aprueba, publica, extrae ni altera originales.`;

export const runPrepareIndividual = async (args: readonly string[], workspace: string): Promise<boolean> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine(prepareIndividualHelp);
    return true;
  }
  if (args.includes("--help")) throw new Error("--help no admite otros argumentos");
  const options = parseIndividualCatalogProviders(args);
  printReportLine(formatHeader(`PASO 1/3 · PREPARAR ${options.dryRun ? "· SIMULACIÓN" : ""}`));
  const results = await prepareIndividualCatalogs({ workspace, providers: options.providerIds, dryRun: options.dryRun });
  let total = 0;
  let ready = 0;
  let review = 0;
  let blocked = 0;
  for (const result of results) {
    if (!result.summary) {
      blocked += 1;
      printStatus("FAIL", `${result.providerId.toUpperCase()} | BLOQUEADA | ${result.error}`);
      printReportLine(`  Sin aprobación/publicación. Revisa el original, preparación o manifest; corrige la causa y repite catalogo:preparar`);
      continue;
    }
    const summary = result.summary;
    total += summary.sourceCount;
    ready += summary.ready;
    review += summary.review;
    printStatus(summary.review ? "WARN" : "PASS", `${result.providerId.toUpperCase()} | ${summary.status.toUpperCase()} | ${summary.sourceCount} fichas`);
    printReportLine(`  ready: ${summary.ready} | review: ${summary.review} | incidencias: ${summary.incidences}`);
    printReportLine(`  ${summary.preparationFile ? "Preparación verificada" : "Previsualización"} | Sin aprobación ni activación`);
    if (summary.activeAvailable) {
      printReportLine(`  Frente a vigente (provisional): altas ready ${summary.possibleAdds} | ausencias ready ${summary.possibleRemovals} | cambios ${summary.possibleChanges}`);
      if (summary.possibleSpecificationLosses) printReportLine(`  AVISO | Posibles pérdidas técnicas antes de exclusiones acreditadas: ${summary.possibleSpecificationLosses}`);
      printReportLine(`  Ausencias respecto al vigente (antecedentes, NO exclusiones aprobadas): ${summary.historicalExclusions.length}`);
    } else printReportLine(`  Sin publicación individual vigente | ready candidatos: ${summary.ready}`);
    if (summary.reviewReferences.length) {
      printReportLine(`  Referencias review: ${summary.reviewReferences.slice(0, 20).join(", ")}${summary.reviewReferences.length > 20 ? ` (+${summary.reviewReferences.length - 20})` : ""}`);
    }
    for (const issue of summary.diagnostics.issues.slice(0, 5)) {
      const label = issue.code.length > 110 ? `${issue.code.slice(0, 107)}…` : issue.code;
      printReportLine(`  ${label}: ${issue.affected} | ${issue.examples.join(", ")}`);
    }
    if (summary.preparationFile) printReportLine(`  Preparación: ${summary.preparationFile}`);
    else printReportLine("  SIMULACIÓN | Sin archivos escritos");
  }
  printReportLine(`RESUMEN | proveedores: ${results.length - blocked}/${results.length} | fichas: ${total} | ready: ${ready} | review: ${review} | bloqueados: ${blocked}`);
  if (blocked) {
    printStatus("FAIL", "PASO 1 BLOQUEADO | No continuar a la acreditación hasta resolver los bloqueos");
    return false;
  }
  printStatus("PASS", options.dryRun ? "SIMULACIÓN COMPLETA | Sin escrituras" : "PASO 1 COMPLETO | Siguiente: npm run catalogo:acreditar");
  return true;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
  runPrepareIndividual(process.argv.slice(2), root).then((ok) => {
    if (!ok) process.exitCode = 1;
  }).catch((error: unknown) => {
    printCommandError("catalogo:preparar", error);
    process.exitCode = 1;
  });
}

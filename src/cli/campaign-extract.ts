import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractCampaign } from "../pipeline/campaign/extraction.js";
import { inspectBeforeExtraction } from "../pipeline/campaign/preflight.js";
import { reviewActiveCampaign } from "../pipeline/campaign/review.js";
import { BatchConsole } from "./reporting/batch-progress.js";
import { formatBatchSummary } from "./reporting/batch-summary.js";
import { printCommandError } from "./reporting/errors.js";
import { printCampaignReview } from "./reporting/campaign-review.js";
import { formatHeader, printStatus } from "./reporting/terminal.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

export const runCampaignExtraction = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Uso: npm run extraer [-- --nueva]\nExtrae los tres proveedores en un lote aislado, comprueba sus archivos y ejecuta preparación/revisión. --nueva permite empezar otro lote después de uno incompleto o con avisos.");
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== "--nueva")) {
    throw new Error("Opción desconocida; usa npm run ayuda -- extraer");
  }
  console.log(formatHeader("EXTRACCIÓN"));
  const previous = await inspectBeforeExtraction(root);
  console.log(`ANTERIOR | ${previous.campaign.runId ?? "sin lote"} | ${previous.campaign.status}`);
  for (const issue of previous.campaign.issues) printStatus("WARN", issue);
  if (previous.campaign.runId === null && previous.campaign.issues.some((issue) =>
    issue.startsWith("No se puede acreditar el lote") || issue.startsWith("Varios lotes"))) {
    throw new Error("El historial contiene run.json inválidos o ambiguos; resolverlos antes de empezar otra campaña");
  }
  if (previous.requiresNewCampaign && !args.includes("--nueva")) {
    throw new Error("La campaña anterior requiere atención. Ejecuta npm run revisar o inicia un lote nuevo con --nueva");
  }
  const scriptFile = fileURLToPath(new URL("./scrape.js", import.meta.url));
  const { report, reportFile } = await extractCampaign(root, scriptFile, args.includes("--nueva"), new BatchConsole());
  for (const line of formatBatchSummary(report, reportFile)) console.log(line);
  if (report.status !== "complete") {
    printStatus("FAIL", "EXTRACCIÓN | Incompleta: conserva el lote y sus errores; no se preparan otros proveedores ni se selecciona");
    process.exitCode = 1;
    return;
  }
  printStatus("PASS", "EXTRACCIÓN | Tres proveedores completos y catálogos verificados; iniciando revisión offline");
  const reviewed = await reviewActiveCampaign(root);
  printCampaignReview(reviewed);
  if (reviewed.complete) console.log("  SIGUIENTE | npm run acreditar (crear o consultar acreditación)");
  else console.log("  SIGUIENTE | npm run estado (diagnosticar antes de avanzar)");
  if (!reviewed.complete) process.exitCode = 1;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignExtraction(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("extraer", error);
    process.exitCode = 1;
  });
}

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeWorkspace, workspaceDirectories } from "../../../infrastructure/filesystem/workspace.js";
import { discoverCampaign } from "../../../pipeline/campaign/discovery/search.js";
import { inspectCampaignOperations } from "../../../pipeline/campaign/operations-status.js";
import { printCampaignOperations } from "../../reporting/campaign-operations.js";
import { printCommandError } from "../../reporting/errors.js";
import { formatHeader, printStatus, printReportLine } from "../../reporting/terminal.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

export const runStart = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine("Uso: npm run iniciar\nComprueba el entorno, crea storage/ de trabajo y descubre el último lote por run.json y sus huellas. No extrae ni publica.");
    return;
  }
  if (args.length !== 0) throw new Error("iniciar no acepta argumentos; usa npm run iniciar");
  await initializeWorkspace(root);
  printReportLine(formatHeader("INICIO"));
  printStatus("PASS", "INICIO | Entorno y datos estructurales correctos");
  for (const path of workspaceDirectories(root)) printReportLine(`  Trabajo: ${path}`);
  const campaign = await discoverCampaign(root);
  if (!campaign.runId) {
    printReportLine(campaign.issues.length > 0
      ? "CAMPAÑA | Sin lote acreditable; revisar avisos antes de extraer"
      : "CAMPAÑA | Sin lote anterior; preparada para una extracción nueva");
  } else {
    printReportLine(`CAMPAÑA | ${campaign.runId} | ${campaign.status}`);
    printReportLine(`  Lote: ${campaign.runFile}`);
  }
  for (const provider of campaign.providers) {
    printReportLine(`  ${provider.providerId} | ${provider.state}${provider.message ? ` | ${provider.message}` : ""}`);
    if (provider.catalog) printReportLine(`    Catálogo: ${provider.catalog.path} | SHA256 ${provider.catalog.sha256}`);
    if (provider.preparation) printReportLine(`    Preparación: ${provider.preparation.path} | SHA256 ${provider.preparation.sha256}${provider.preparation.intervened ? " | intervenida" : ""}`);
  }
  for (const issue of campaign.issues) printStatus("WARN", issue);
  printReportLine("\nORIENTACIÓN OPERATIVA");
  printCampaignOperations(await inspectCampaignOperations(root));
  if (campaign.providers.some((provider) => provider.state === "invalid") ||
    campaign.issues.some((issue) => !issue.startsWith("Lote ") && !issue.startsWith("Lote completado"))) {
    process.exitCode = 1;
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runStart(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("iniciar", error);
    process.exitCode = 1;
  });
}

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeWorkspace, workspaceDirectories } from "../infrastructure/filesystem/workspace.js";
import { discoverCampaign } from "../pipeline/campaign/discovery.js";
import { printCommandError } from "./reporting/errors.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

export const runStart = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Uso: npm run iniciar\nComprueba el entorno, crea storage/ de trabajo y descubre el último lote por run.json y sus huellas. No extrae ni publica.");
    return;
  }
  if (args.length !== 0) throw new Error("iniciar no acepta argumentos; usa npm run iniciar");
  await initializeWorkspace(root);
  console.log("INICIO | Entorno y datos estructurales correctos");
  for (const path of workspaceDirectories(root)) console.log(`  Trabajo: ${path}`);
  const campaign = await discoverCampaign(root);
  if (!campaign.runId) {
    console.log(campaign.issues.length > 0
      ? "CAMPAÑA | Sin lote acreditable; revisar avisos antes de extraer"
      : "CAMPAÑA | Sin lote anterior; preparada para una extracción nueva");
  } else {
    console.log(`CAMPAÑA | ${campaign.runId} | ${campaign.status}`);
    console.log(`  Lote: ${campaign.runFile}`);
  }
  for (const provider of campaign.providers) {
    console.log(`  ${provider.providerId} | ${provider.state}${provider.message ? ` | ${provider.message}` : ""}`);
    if (provider.catalog) console.log(`    Catálogo: ${provider.catalog.path} | SHA256 ${provider.catalog.sha256}`);
    if (provider.preparation) console.log(`    Preparación: ${provider.preparation.path} | SHA256 ${provider.preparation.sha256}${provider.preparation.intervened ? " | intervenida" : ""}`);
  }
  for (const issue of campaign.issues) console.warn(`  AVISO | ${issue}`);
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

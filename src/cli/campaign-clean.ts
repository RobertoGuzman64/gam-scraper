import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findDesktopDirectory } from "../infrastructure/filesystem/desktop-directory.js";
import { cleanDeliveredCampaign } from "../pipeline/campaign/cleanup.js";
import { printCommandError } from "./reporting/errors.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

export const runCampaignCleanup = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Uso: npm run campana:limpiar [-- --aplicar]\nSimula la limpieza del lote entregado; --aplicar elimina solo sus artefactos reconocidos tras verificar de nuevo el ZIP del Escritorio. Conserva scripts y trabajos sin acreditar.");
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== "--aplicar")) {
    throw new Error("Solo se admite --aplicar para autorizar la limpieza");
  }
  const dryRun = args.length === 0;
  const desktop = await findDesktopDirectory();
  const result = await cleanDeliveredCampaign(root, desktop, dryRun);
  console.log(`LIMPIEZA CAMPAÑA | ${dryRun ? "SIMULACIÓN" : "COMPLETADA"} | ${result.runId}`);
  for (const path of result.directories) console.log(`  ${dryRun ? "ELIMINARÍA" : "ELIMINADO"} | ${path}`);
  console.log(`  Total ${(result.bytes / (1024 * 1024)).toFixed(2)} MB | ${result.directories.length} carpetas`);
  if (result.preservedScripts) console.log(`  Scripts conservados: ${result.preservedScripts}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignCleanup(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("campana:limpiar", error);
    process.exitCode = 1;
  });
}

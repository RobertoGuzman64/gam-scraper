import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findDesktopDirectory } from "../infrastructure/filesystem/desktop-directory.js";
import { updateActiveCampaignReference } from "../pipeline/campaign/reference-update.js";
import { printCommandError } from "./reporting/errors.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

export const runCampaignReferenceUpdate = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Uso: npm run campana:referencia -- --actualizar\nActualiza la referencia única después de entregar y antes de limpiar. Revalida la entrega acreditada y conserva los tres catálogos completos; sin --actualizar no se escribe nada.");
    return;
  }
  if (args.length !== 1 || args[0] !== "--actualizar") {
    throw new Error("campana:referencia solo admite --actualizar; compara primero con npm run campana:comparar");
  }
  const desktop = await findDesktopDirectory();
  const result = await updateActiveCampaignReference(root, desktop);
  console.log(`REFERENCIA | ${result.comparison.baseline === "initial" ? "INICIALIZADA" : "ACTUALIZADA"} | ${result.manifest.runId}`);
  for (const provider of result.comparison.providers) {
    console.log(`  ${provider.providerId.toUpperCase()} | anterior ${provider.previousCount} | actual ${provider.currentCount} | altas ${provider.added.length} | ausencias ${provider.missing.length} | modificaciones ${provider.modified.length} | sin cambios ${provider.unchanged}`);
  }
  console.log("  Referencia comprobada: data/referencia (3 catálogos completos, manifest.json y diferencias.json)");
  console.log("  Solo se conserva la referencia vigente y el informe más reciente. Puedes inspeccionar la limpieza con npm run campana:limpiar.");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignReferenceUpdate(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("campana:referencia", error);
    process.exitCode = 1;
  });
}

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectCampaignReference } from "../infrastructure/filesystem/campaign-reference.js";
import { findDesktopDirectory } from "../infrastructure/filesystem/desktop-directory.js";
import { deliverActiveCampaign } from "../pipeline/campaign/delivery.js";
import { printCommandError } from "./reporting/errors.js";
import { formatHeader, printStatus } from "./reporting/terminal.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

export const runCampaignDelivery = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Uso: npm run entregar\nValida la selección acreditada del lote actual y entrega en el Escritorio equipzilla-AAAA-MM-DD.zip con los cuatro JSON publicables. Conserva la entrega anterior si falla.");
    return;
  }
  if (args.length) throw new Error("entregar no admite opciones");
  const desktop = await findDesktopDirectory();
  const delivery = await deliverActiveCampaign(root, desktop);
  console.log(formatHeader("ENTREGA"));
  printStatus("PASS", `ENTREGA | ${delivery.runId} | ${delivery.date}`);
  console.log(`  GAM ${delivery.products.gam} | Gomariz ${delivery.products.gomariz} | Mercaeleva ${delivery.products.mercaeleva} | Manain ${delivery.products.manain}`);
  printStatus("PASS", `ZIP comprobado: ${delivery.zipFile}`);
  const reference = await inspectCampaignReference(root);
  if (reference.status === "valid" && reference.reference.manifest.runId === delivery.runId) {
    console.log("  REFERENCIA | Este lote ya es la referencia vigente; no necesitas actualizarla otra vez");
    console.log("  SIGUIENTE | npm run limpiar (simula la limpieza)");
  } else if (reference.status === "valid" || reference.status === "absent") {
    console.log("  SIGUIENTE | npm run comparar (solo lectura)");
    console.log("  OPCIONAL | npm run referencia -- --actualizar (antes de limpiar)");
    console.log("  SIGUIENTE | npm run limpiar (simulación; no requiere actualizar referencia)");
  } else {
    printStatus("WARN", `Referencia ${reference.status}; consultar npm run referencia antes de actualizarla`);
    console.log("  SIGUIENTE | npm run limpiar (simulación; no requiere actualizar referencia)");
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignDelivery(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("entregar", error);
    process.exitCode = 1;
  });
}

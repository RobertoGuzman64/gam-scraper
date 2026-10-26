import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findDesktopDirectory } from "../infrastructure/filesystem/desktop-directory.js";
import { deliverActiveCampaign } from "../pipeline/campaign/delivery.js";
import { printCommandError } from "./reporting/errors.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

export const runCampaignDelivery = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Uso: npm run campana:entregar\nValida la selección acreditada del lote actual y entrega en el Escritorio equipzilla-AAAA-MM-DD.zip con los tres JSON publicables. Conserva la entrega anterior si falla.");
    return;
  }
  if (args.length) throw new Error("campana:entregar no admite opciones");
  const desktop = await findDesktopDirectory();
  const delivery = await deliverActiveCampaign(root, desktop);
  console.log(`ENTREGA | ${delivery.runId} | ${delivery.date}`);
  console.log(`  GAM ${delivery.products.gam} | Gomariz ${delivery.products.gomariz} | Mercaeleva ${delivery.products.mercaeleva}`);
  console.log(`  ZIP comprobado: ${delivery.zipFile}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignDelivery(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("campana:entregar", error);
    process.exitCode = 1;
  });
}

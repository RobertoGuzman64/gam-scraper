import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectCampaignOperations } from "../../../pipeline/campaign/operations-status.js";
import { inspectOperationsInventory } from "../../../pipeline/campaign/operations-inventory.js";
import { printOperationsInventory } from "../../reporting/operations-inventory.js";
import { printCommandError } from "../../reporting/errors.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

export const runCampaignStatus = async (args: readonly string[], rootDirectory: string = root): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Uso: npm run estado\nConsulta recursos esenciales, proveedores, campañas, acreditación y referencia, sin escribir archivos ni sugerir siguientes pasos.");
    return;
  }
  if (args.length) throw new Error("estado no admite argumentos");
  const status = await inspectCampaignOperations(rootDirectory);
  printOperationsInventory(status, await inspectOperationsInventory(rootDirectory, status));
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignStatus(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("estado", error);
    process.exitCode = 1;
  });
}

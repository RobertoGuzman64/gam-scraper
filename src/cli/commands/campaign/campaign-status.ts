import { printReportLine } from "../../reporting/terminal.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectCampaignOperations } from "../../../campaign/operations-status.js";
import { inspectOperationsInventory } from "../../../campaign/operations-inventory.js";
import { printOperationsInventory } from "../../reporting/operations-inventory.js";
import { printCommandError } from "../../reporting/errors.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

export const runCampaignStatus = async (args: readonly string[], rootDirectory: string = root): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine("Uso: npm run estado -- [--detalle]\nConsulta recursos esenciales, proveedores, campañas, acreditación y referencia, sin escribir archivos ni sugerir siguientes pasos.");
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== "--detalle")) throw new Error("estado solo admite --detalle");
  const status = await inspectCampaignOperations(rootDirectory);
  printOperationsInventory(status, await inspectOperationsInventory(rootDirectory, status), args[0] === "--detalle");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignStatus(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("estado", error);
    process.exitCode = 1;
  });
}

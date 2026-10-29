import { printReportLine } from "../../reporting/terminal.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewActiveCampaign } from "../../../pipeline/campaign/review.js";
import { printCommandError } from "../../reporting/errors.js";
import { printCampaignReview } from "../../reporting/campaign-review.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

export const runCampaignReview = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine("Uso: npm run revisar\nDescubre el último lote, prepara y valida catálogos sin intervenir ni seleccionar; muestra todas las fichas Review y sus motivos.");
    return;
  }
  if (args.length > 0) throw new Error("revisar no acepta argumentos");
  const result = await reviewActiveCampaign(root);
  printCampaignReview(result);
  if (result.complete) printReportLine("  SIGUIENTE | npm run acreditar (borrador o selección, según acreditación vigente)");
  else printReportLine("  SIGUIENTE | Resolver los avisos del lote; consultar npm run estado");
  if (!result.complete) process.exitCode = 1;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignReview(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("revisar", error);
    process.exitCode = 1;
  });
}

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { finalizeActiveCampaign } from "../pipeline/campaign/finalization.js";
import { printCommandError } from "./reporting/errors.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

export const runCampaignFinalization = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Uso: npm run campana:finalizar [-- --simular]\nCrea el borrador específico de las tres preparaciones vigentes, espera las decisiones humanas y genera la selección publicable solo cuando la acreditación esté aprobada. --simular no crea archivos.");
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== "--dry-run")) {
    throw new Error("Opción desconocida: campana:finalizar solo admite --simular");
  }
  const result = await finalizeActiveCampaign(root, args.length === 1);
  console.log(`CAMPAÑA | ${result.runId} | ${result.status.toUpperCase()}`);
  console.log(`  Borrador asociado a las preparaciones vigentes: ${result.draftFile}`);
  console.log(`  Decisiones editoriales necesarias: ${result.decisions}`);
  if (result.status === "draft") {
    console.log("  Revisa y completa approved, approvalReason y las decisiones con sus evidencias. Vuelve a ejecutar campana:finalizar");
  } else if (result.status === "pending") {
    console.log("  Acreditación todavía sin aprobar; no se han publicado archivos");
  } else if (result.selection) {
    console.log(`  Originales ${result.selection.totals.original} | Publicables ${result.selection.totals.publishable} | Excluidos ${result.selection.totals.excluded}`);
    console.log(result.selectionDir
      ? `  Selección íntegra para la fase de entrega: ${result.selectionDir}`
      : "  Simulación válida; no se ha escrito ningún archivo");
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignFinalization(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("campana:finalizar", error);
    process.exitCode = 1;
  });
}

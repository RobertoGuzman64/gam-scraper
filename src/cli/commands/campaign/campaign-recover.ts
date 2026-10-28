import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { abandonFailedCampaign, inspectRecoverableCampaign, recoverCompletedCampaign, resumePendingCampaignRemoval } from "../../../pipeline/campaign/retention/recovery.js";
import { withCampaignAdmissionLock } from "../../../pipeline/campaign/retention/admission.js";
import { printCommandError } from "../../reporting/errors.js";
import { formatHeader, printStatus } from "../../reporting/terminal.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

export const runCampaignRecovery = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Uso: npm run recuperar -- <runId> | --recuperar <runId> | --abandonar <runId> --confirmar <runId> | --reanudar-rotacion\nLa consulta conserva íntegramente la campaña fallida y muestra si se puede abandonar. El abandono requiere dos identificaciones explícitas y nunca elimina una entrega acreditada ni trabajos editoriales.");
    return;
  }
  if (args.length === 1 && args[0] === "--reanudar-rotacion") {
    await withCampaignAdmissionLock(root, () => resumePendingCampaignRemoval(root));
    printStatus("PASS", "Se ha comprobado y reanudado la retirada pendiente cuando existía; ninguna campaña ajena se ha eliminado");
    return;
  }
  if (args.length === 1 && args[0] && !args[0].startsWith("--")) {
    const result = await inspectRecoverableCampaign(root, args[0]);
    console.log(formatHeader("RECUPERACIÓN"));
    printStatus("WARN", `Campaña ${result.runId} | ${result.status} | archivos preservados`);
    console.log(`  Ningún dato se ha modificado. Si los cuatro canónicos están completos: npm run recuperar -- --recuperar ${result.runId}`);
    console.log(`  Si decides descartar el intento: npm run recuperar -- --abandonar ${result.runId} --confirmar ${result.runId}`);
    return;
  }
  if (args.length === 2 && args[0] === "--recuperar" && args[1]) {
    await recoverCompletedCampaign(root, args[1]);
    printStatus("PASS", `Campaña ${args[1]} recuperada tras comprobar los cuatro catálogos; continuar con npm run revisar`);
    return;
  }
  if (args.length === 4 && args[0] === "--abandonar" && args[1] && args[2] === "--confirmar" && args[3] === args[1]) {
    await abandonFailedCampaign(root, args[1]);
    printStatus("PASS", `Campaña fallida ${args[1]} abandonada expresamente; ninguna otra campaña se ha eliminado`);
    return;
  }
  throw new Error("Uso incorrecto; identifica dos veces el mismo runId para autorizar el abandono");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignRecovery(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("recuperar", error);
    process.exitCode = 1;
  });
}

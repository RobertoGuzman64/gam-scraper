import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectCampaignReference } from "../../../infrastructure/filesystem/reference/store.js";
import { findDesktopDirectory } from "../../../infrastructure/filesystem/desktop-directory.js";
import { cleanDeliveredCampaign } from "../../../pipeline/campaign/cleanup.js";
import { printCommandError } from "../../reporting/errors.js";
import { formatHeader, printStatus, printReportLine } from "../../reporting/terminal.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

export const runCampaignCleanup = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine("Uso: npm run limpiar [-- --aplicar]\nSimula la limpieza del lote entregado; --aplicar elimina solo sus artefactos reconocidos tras verificar de nuevo el ZIP del Escritorio. Conserva scripts y trabajos sin acreditar.");
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== "--aplicar")) {
    throw new Error("Solo se admite --aplicar para autorizar la limpieza");
  }
  const dryRun = args.length === 0;
  const reference = await inspectCampaignReference(root);
  if (!dryRun && reference.status !== "valid") {
    printStatus("WARN", "La eliminación está autorizada, pero la referencia no consta íntegra. Los originales del lote se perderán.");
  }
  const desktop = await findDesktopDirectory();
  const result = await cleanDeliveredCampaign(root, desktop, dryRun);
  printReportLine(formatHeader("LIMPIEZA"));
  if (reference.status === "valid" && reference.reference.manifest.runId === result.runId) {
    printStatus("PASS", "REFERENCIA | Ya corresponde al lote entregado; se conservará fuera de la limpieza");
  } else {
    printStatus("WARN", dryRun
      ? "La limpieza eliminaría los originales. Si quieres conservar el inventario como referencia, actualízala antes de aplicar."
      : "Los originales ya se han eliminado; la referencia anterior no se modifica ni actualiza automáticamente.");
    if (reference.status === "invalid" || reference.status === "recoverable") printReportLine("  AVISO | Consultar primero npm run referencia por su estado de integridad");
  }
  printStatus(dryRun ? "WARN" : "PASS", `LIMPIEZA CAMPAÑA | ${dryRun ? "SIMULACIÓN" : "COMPLETADA"} | ${result.runId}`);
  for (const area of result.inventory) {
    printReportLine(`  ${dryRun ? "ELIMINARÍA" : "ELIMINADO"} | ${area.path}`);
    for (const group of area.details.breakdown) {
      printReportLine(`    ${group.kind} | ${group.files} archivos | ${(group.bytes / (1024 * 1024)).toFixed(2)} MB`);
    }
  }
  printReportLine(`  Total ${(result.bytes / (1024 * 1024)).toFixed(2)} MB | ${result.directories.length} carpetas`);
  if (result.preservedScripts) printReportLine(`  Scripts conservados: ${result.preservedScripts}`);
  if (dryRun) printReportLine("  SIGUIENTE | Revisar el inventario y, solo si procede, npm run limpiar -- --aplicar");
  else printReportLine("  SIGUIENTE | npm run referencia (consulta autónoma) o npm run estado");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignCleanup(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("limpiar", error);
    process.exitCode = 1;
  });
}

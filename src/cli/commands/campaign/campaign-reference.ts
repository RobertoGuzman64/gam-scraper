import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exportCampaignReference, importCampaignReference, recoverCampaignReference } from "../../../pipeline/campaign/reference/maintenance.js";
import { inspectCampaignReference } from "../../../infrastructure/filesystem/reference/store.js";
import { findDesktopDirectory } from "../../../infrastructure/filesystem/desktop-directory.js";
import { updateActiveCampaignReference } from "../../../pipeline/campaign/reference/update-legacy.js";
import { printCommandError } from "../../reporting/errors.js";
import { formatHeader, printStatus, printReportLine } from "../../reporting/terminal.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

export const runCampaignReferenceUpdate = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine(`Uso:
  npm run referencia
  npm run referencia -- --actualizar
  npm run referencia -- --recuperar
  npm run referencia -- --exportar <carpeta-nueva>
  npm run referencia -- --importar <carpeta-existente> [--sustituir]
Sin argumentos comprueba los catálogos, el manifiesto y las diferencias y sus SHA sin necesitar campaña ni escribir datos.
--recuperar repara explícitamente una transacción interrumpida si existe un respaldo íntegro.
--actualizar es un procedimiento legado opcional que exige entrega acreditada. --exportar copia una referencia íntegra a una carpeta nueva.
--importar valida la referencia y no reemplaza la actual salvo autorización --sustituir.
Política Git y traslado: docs/OPERATIONAL_REFERENCE.md`);
    return;
  }
  if (args.length === 0) {
    printReportLine(formatHeader("REFERENCIA"));
    const inspection = await inspectCampaignReference(root);
    if (inspection.status === "absent") {
      printStatus("WARN", "REFERENCIA | AUSENTE | No se ha inicializado una referencia operativa");
      return;
    }
    if (inspection.status === "invalid") {
      throw new Error(`REFERENCIA | INVÁLIDA | ${inspection.reason}`);
    }
    const manifest = inspection.reference.manifest;
    printStatus(inspection.status === "valid" ? "PASS" : "WARN", `REFERENCIA | ${inspection.status === "valid" ? "VÁLIDA" : "RECUPERABLE"} | ${manifest.runId}`);
    printReportLine(`  Creada: ${manifest.createdAt}`);
    for (const entry of manifest.catalogs) {
      printReportLine(`  ${entry.providerId.toUpperCase()} | ${entry.productCount} originales | SHA256 ${entry.sha256}`);
    }
    printReportLine(`  Comprobados los ${manifest.catalogs.length} catálogos originales, manifest.json y differences.json`);
    if (inspection.status === "recoverable") printReportLine(`  ATENCIÓN | ${inspection.reason}. La consulta no ha reparado ni modificado archivos`);
    else printReportLine("  Consulta terminada sin escrituras y sin necesitar campaña activa");
    return;
  }
  if (args.length === 1 && args[0] === "--recuperar") {
    const manifest = await recoverCampaignReference(root);
    printStatus("PASS", `REFERENCIA | RECUPERADA | ${manifest.runId}`);
    printReportLine("  Referencia vigente y transacción comprobadas sin necesitar una campaña activa");
    return;
  }
  if (args.length === 2 && args[0] === "--exportar" && args[1]?.trim()) {
    const manifest = await exportCampaignReference(root, args[1]);
    printStatus("PASS", `REFERENCIA | EXPORTADA | ${manifest.runId} | ${args[1]}`);
    printReportLine(`  Verificados los ${manifest.catalogs.length + 2} archivos de traslado; conservar fuera del repositorio y de Git`);
    return;
  }
  if ((args.length === 2 || args.length === 3) && args[0] === "--importar" && args[1]?.trim() &&
    (args.length === 2 || args[2] === "--sustituir")) {
    const manifest = await importCampaignReference(root, args[1], args.length === 3);
    printStatus("PASS", `REFERENCIA | IMPORTADA | ${manifest.runId}`);
    printReportLine(`  Verificados los ${manifest.catalogs.length + 2} archivos y su integridad; la referencia operativa queda en data/reference`);
    return;
  }
  if (args.length !== 1 || args[0] !== "--actualizar") {
    throw new Error("Opciones inválidas para referencia; consulta npm run ayuda -- referencia");
  }
  const desktop = await findDesktopDirectory();
  const result = await updateActiveCampaignReference(root, desktop);
  printStatus("PASS", `REFERENCIA | ${result.comparison.baseline === "initial" ? "INICIALIZADA" : "ACTUALIZADA"} | ${result.manifest.runId}`);
  for (const provider of result.comparison.providers) {
    printReportLine(`  ${provider.providerId.toUpperCase()} | anterior ${provider.previousCount} | actual ${provider.currentCount} | altas ${provider.added.length} | ausencias ${provider.missing.length} | modificaciones ${provider.modified.length} | sin cambios ${provider.unchanged}`);
  }
  printReportLine(`  Referencia comprobada: data/reference (${result.manifest.catalogs.length} catálogos completos, manifest.json y differences.json)`);
  printReportLine("  La comparación ordinaria utiliza los originales de las campañas retenidas; esta actualización es legada.");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCampaignReferenceUpdate(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("referencia", error);
    process.exitCode = 1;
  });
}

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exportCampaignReference, importCampaignReference, inspectCampaignReference, recoverCampaignReference } from "../infrastructure/filesystem/campaign-reference.js";
import { findDesktopDirectory } from "../infrastructure/filesystem/desktop-directory.js";
import { updateActiveCampaignReference } from "../pipeline/campaign/reference-update.js";
import { printCommandError } from "./reporting/errors.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

export const runCampaignReferenceUpdate = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log(`Uso:
  npm run campana:referencia
  npm run campana:referencia -- --actualizar
  npm run campana:referencia -- --recuperar
  npm run campana:referencia -- --exportar <carpeta-nueva>
  npm run campana:referencia -- --importar <carpeta-existente> [--sustituir]
Sin argumentos comprueba los cinco JSON y sus SHA sin necesitar campaña ni escribir datos.
--recuperar repara explícitamente una transacción interrumpida si existe un respaldo íntegro.
--actualizar exige entrega acreditada. --exportar copia una referencia íntegra a una carpeta nueva.
--importar valida la referencia y no reemplaza la actual salvo autorización --sustituir.
Política Git y traslado: docs/REFERENCIA_OPERATIVA.md`);
    return;
  }
  if (args.length === 0) {
    const inspection = await inspectCampaignReference(root);
    if (inspection.status === "absent") {
      console.log("REFERENCIA | AUSENTE | No se ha inicializado una referencia operativa");
      return;
    }
    if (inspection.status === "invalid") {
      throw new Error(`REFERENCIA | INVÁLIDA | ${inspection.reason}`);
    }
    const manifest = inspection.reference.manifest;
    console.log(`REFERENCIA | ${inspection.status === "valid" ? "VÁLIDA" : "RECUPERABLE"} | ${manifest.runId}`);
    console.log(`  Creada: ${manifest.createdAt}`);
    for (const entry of manifest.catalogs) {
      console.log(`  ${entry.providerId.toUpperCase()} | ${entry.productCount} originales | SHA256 ${entry.sha256}`);
    }
    console.log("  Comprobados los 3 catálogos originales, manifest.json y diferencias.json");
    if (inspection.status === "recoverable") console.log(`  ATENCIÓN | ${inspection.reason}. La consulta no ha reparado ni modificado archivos`);
    else console.log("  Consulta terminada sin escrituras y sin necesitar campaña activa");
    return;
  }
  if (args.length === 1 && args[0] === "--recuperar") {
    const manifest = await recoverCampaignReference(root);
    console.log(`REFERENCIA | RECUPERADA | ${manifest.runId}`);
    console.log("  Referencia vigente y transacción comprobadas sin necesitar una campaña activa");
    return;
  }
  if (args.length === 2 && args[0] === "--exportar" && args[1]?.trim()) {
    const manifest = await exportCampaignReference(root, args[1]);
    console.log(`REFERENCIA | EXPORTADA | ${manifest.runId} | ${args[1]}`);
    console.log("  Verificados los cinco archivos de traslado; conservar fuera del repositorio y de Git");
    return;
  }
  if ((args.length === 2 || args.length === 3) && args[0] === "--importar" && args[1]?.trim() &&
    (args.length === 2 || args[2] === "--sustituir")) {
    const manifest = await importCampaignReference(root, args[1], args.length === 3);
    console.log(`REFERENCIA | IMPORTADA | ${manifest.runId}`);
    console.log("  Verificados los cinco archivos y su integridad; la referencia operativa queda en data/referencia");
    return;
  }
  if (args.length !== 1 || args[0] !== "--actualizar") {
    throw new Error("Opciones inválidas para campana:referencia; consulta npm run ayuda -- campana:referencia");
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

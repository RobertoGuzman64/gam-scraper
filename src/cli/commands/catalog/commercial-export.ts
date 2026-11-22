import { mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { resolve, relative, isAbsolute, join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { findDesktopDirectory } from "../../../infrastructure/filesystem/desktop-directory.js";
import { deliverCommercialPackages } from "../../reporting/commercial-package-delivery.js";
import { inspectCommercialPackage } from "../../../commercial/export/commercial-package-snapshot.js";
import { prepareCommercialExportPreflight } from "../../../commercial/export/commercial-export-preflight.js";
import { renderCommercialExportPreflight } from "../../reporting/commercial-export-preflight.js";
import { verifyCommercialExportDirectory, verifyCommercialExportSources } from "../../../commercial/export/commercial-export-verification.js";
import type { CommercialEnvironment } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { printCommandHeader, printCommandSection, printCommandResult, printCommandDeliverable, printCommandProvider, printReportLine, formatReportLine } from "../../reporting/terminal.js";
import { printCommandError } from "../../reporting/errors.js";
import { OperationProgress } from "../../reporting/operation-progress.js";
import { writeLocalPanel } from "../../../panel/application/write-local-panel.js";
import { prepareExplorerTechnicalEvidence } from "../../../tools/catalog/prepare-explorer-technical-evidence.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

export type CommercialExportOptions = {
  readonly out: string | null;
  readonly environment: CommercialEnvironment | null;
  readonly dryRun: boolean;
};

export const parseCommercialExportOptions = (args: readonly string[]): CommercialExportOptions | "help" => {
  if (args.length === 1 && args[0] === "--help") return "help";
  let out: string | null = null;
  let environment: CommercialEnvironment | null = null;
  let dryRun = false;
  for (let i = 0; i < args.length; i += 1) {
    const original = args[i];
    const arg = original === "--salida" ? "--out" : original === "--entorno" ? "--environment" :
      original === "--simular" ? "--dry-run" : original;
    if (arg === "--dry-run" && !dryRun) { dryRun = true; continue; }
    if (arg === "--out" && out === null) {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error("--out requiere un directorio nuevo");
      out = value;
      continue;
    }
    if (arg === "--environment" && environment === null) {
      const value = args[++i];
      if (value !== "develop" && value !== "production") throw new Error("--environment: develop o production");
      environment = value;
      continue;
    }
    throw new Error(`Opción de exportación comercial inválida: ${arg}`);
  }
  if (!dryRun && environment === null) {
    throw new Error("La exportación para importar productos requiere --entorno develop|production");
  }
  if (out) {
    const path = resolve(out);
    const nested = relative(root, path);
    if (nested === "" || (nested !== ".." && !nested.startsWith(`..${sep}`) && !isAbsolute(nested))) {
      throw new Error("La salida comercial debe estar fuera del repositorio para proteger sus datos técnicos");
    }
  }
  return { out, environment, dryRun };
};

export const shouldRefreshLocalPanel = (options: CommercialExportOptions): boolean =>
  options.environment === "develop" && !options.dryRun && options.out === null;

export const runCommercialExport = async (args: readonly string[]): Promise<void> => {
  const options = parseCommercialExportOptions(args);
  if (options === "help") {
    printReportLine("Uso: npm run exportar:comercial -- --entorno develop|production [--simular] [--salida <directorio-nuevo>]\nPor defecto genera dos ZIP verificados en el Escritorio: comercial (tres JSON y manifiesto) e informe de integración. --salida conserva los cuatro archivos sueltos en un directorio nuevo. --simular permite verificar sin elegir entorno. También admite --out, --environment y --dry-run. No publica ni importa en backend.");
    return;
  }
  const progress = new OperationProgress("EXPORTACIÓN COMERCIAL");
  try {
    progress.stage("PREFLIGHT Y PROYECCIÓN", "acreditando y preparando proveedores");
    const { preflight, files } = await prepareCommercialExportPreflight(root, options.environment,
      (providerId, completed, total) => progress.update(`${providerId} · ${completed}/${total} evaluados`, completed, total));
    for (const line of renderCommercialExportPreflight(preflight, options.environment)) progress.log(formatReportLine(line));
    if (preflight.failures.length || preflight.globalFailures.length || preflight.publications.length !== 3) {
      throw new Error(`Preflight comercial no conforme: ${preflight.failures.length} incidencias por proveedor y ${preflight.globalFailures.length} globales. No se exportó ningún archivo`);
    }
    if (!files) throw new Error("Preflight comercial sin corte exportable");
    const manifest = files.find((item) => item.name === "commercial-manifest.json");
    if (!manifest) throw new Error("Falta el manifiesto comercial");
    if (options.dryRun) {
      progress.stage("VERIFICACIÓN", "contrastando fuentes comerciales");
      await verifyCommercialExportSources(root, files);
      progress.finish();
      printCommandHeader("EXPORTACIÓN COMERCIAL", true);
      printReportLine(`Entorno: ${options.environment ?? "sin companyID"} · ${files.length - 1} proveedores · un manifiesto`);
      for (const entry of files) printReportLine(`  ${entry.name} · ${entry.bytes} bytes · calculado, no escrito`);
      printCommandResult("SIMULACIÓN COMPLETA · SIN ESCRITURAS · NO SE CREA NUEVA PUBLICACIÓN");
      return;
    }
    if (options.out === null) {
      progress.stage("ENTREGA", "generando y verificando ZIP comerciales");
      const delivered = await deliverCommercialPackages(root, await findDesktopDirectory(), files);
      progress.finish();
      printCommandHeader("EXPORTACIÓN COMERCIAL");
      for (const provider of inspectCommercialPackage(files).providers) {
        printCommandProvider(provider.providerId, `${provider.summary.exported} productos · ${provider.summary.attributes} atributos`);
      }
      printCommandSection("TOTAL ACREDITADO");
      printReportLine(`${delivered.exported} productos · ${delivered.attributes} atributos · entorno ${delivered.environment}`);
      printCommandSection("ENTREGABLES");
      printCommandDeliverable("COMERCIAL", delivered.commercial);
      printCommandDeliverable("INFORME", delivered.report);
      if (shouldRefreshLocalPanel(options)) {
        const panelProgress = new OperationProgress("PANEL LOCAL");
        try {
          panelProgress.stage("EVIDENCIAS", "preparando explorador técnico");
          await prepareExplorerTechnicalEvidence(root);
          panelProgress.stage("GENERACIÓN", "actualizando HTML y comprobaciones");
          const path = await writeLocalPanel(root);
          panelProgress.finish();
          printCommandDeliverable("PANEL LOCAL", path);
        } catch (error: unknown) {
          panelProgress.abort();
          throw new Error("Exportación comercial entregada, pero la actualización del panel local no se ha completado", { cause: error });
        }
      }
      printCommandResult("Dos ZIP comprobados desde publicaciones vigentes; integración en BD NO VERIFICADA");
      return;
    }
    const destination = resolve(options.out);
    const physicalRoot = await realpath(root);
    const physicalParent = await realpath(dirname(destination));
    const physicalRelative = relative(physicalRoot, physicalParent);
    if (physicalRelative === "" || (physicalRelative !== ".." &&
      !physicalRelative.startsWith(`..${sep}`) && !isAbsolute(physicalRelative))) {
      throw new Error("La salida comercial apunta al repositorio mediante su directorio de destino");
    }
    progress.stage("ESCRITURA", "cuatro archivos comerciales y verificación");
    await mkdir(destination, { recursive: false });
    try {
      for (const entry of files) await writeFile(join(destination, entry.name), entry.content, { flag: "wx" });
      await verifyCommercialExportDirectory(destination, files);
      await verifyCommercialExportSources(root, files);
    } catch (error) {
      await rm(destination, { recursive: true, force: true });
      throw error;
    }
    progress.finish();
    printCommandHeader("EXPORTACIÓN COMERCIAL");
    printReportLine(`${files.length - 1} proveedores · entorno ${options.environment ?? "sin companyID"}`);
    printCommandSection("ARCHIVOS VERIFICADOS");
    for (const entry of files) printReportLine(`  ${entry.name} · ${entry.bytes} bytes`);
    printCommandDeliverable("DIRECTORIO COMERCIAL", destination);
    printCommandResult("Cuatro archivos nuevos desde publicaciones vigentes; publicaciones y backend sin modificar");
  } catch (error) {
    progress.abort();
    throw error;
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCommercialExport(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("exportar:comercial", error);
    process.exitCode = 1;
  });
}

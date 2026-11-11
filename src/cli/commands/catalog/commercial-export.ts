import { mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { resolve, relative, isAbsolute, join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCommercialExportFiles } from "../../../commercial/export/commercial-export.js";
import { findDesktopDirectory } from "../../../infrastructure/filesystem/desktop-directory.js";
import { deliverCommercialPackages } from "../../reporting/commercial-package-delivery.js";
import { inspectCommercialPackage } from "../../../commercial/export/commercial-package-snapshot.js";
import { verifyCommercialExportDirectory, verifyCommercialExportSources } from "../../../commercial/export/commercial-export-verification.js";
import type { CommercialEnvironment } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { printCommandHeader, printCommandSection, printCommandResult, printCommandDeliverable, printCommandProvider, printReportLine } from "../../reporting/terminal.js";
import { printCommandError } from "../../reporting/errors.js";

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

export const runCommercialExport = async (args: readonly string[]): Promise<void> => {
  const options = parseCommercialExportOptions(args);
  if (options === "help") {
    printReportLine("Uso: npm run exportar:comercial -- --entorno develop|production [--simular] [--salida <directorio-nuevo>]\nPor defecto genera dos ZIP verificados en el Escritorio: comercial (tres JSON y manifiesto) e informe de integración. --salida conserva los cuatro archivos sueltos en un directorio nuevo. --simular permite verificar sin elegir entorno. También admite --out, --environment y --dry-run. No publica ni importa en backend.");
    return;
  }
  const files = await buildCommercialExportFiles(root, options.environment);
  const manifest = files.find((item) => item.name === "commercial-manifest.json");
  if (!manifest) throw new Error("Falta el manifiesto comercial");
  if (options.dryRun) {
    await verifyCommercialExportSources(root, files);
    printCommandHeader("EXPORTACIÓN COMERCIAL", true);
    printReportLine(`Entorno: ${options.environment ?? "sin companyID"} · ${files.length - 1} proveedores · un manifiesto`);
    for (const entry of files) printReportLine(`  ${entry.name} · ${entry.bytes} bytes · calculado, no escrito`);
    printCommandResult("SIMULACIÓN COMPLETA · SIN ESCRITURAS");
    return;
  }
  if (options.out === null) {
    const delivered = await deliverCommercialPackages(root, await findDesktopDirectory(), files);
    printCommandHeader("EXPORTACIÓN COMERCIAL");
    for (const provider of inspectCommercialPackage(files).providers) {
      printCommandProvider(provider.providerId, `${provider.summary.exported} productos · ${provider.summary.attributes} atributos`);
    }
    printCommandSection("TOTAL ACREDITADO");
    printReportLine(`${delivered.exported} productos · ${delivered.attributes} atributos · entorno ${delivered.environment}`);
    printCommandSection("ENTREGABLES");
    printCommandDeliverable("COMERCIAL", delivered.commercial);
    printCommandDeliverable("INFORME", delivered.report);
    printCommandResult("Dos ZIP comprobados; integración en BD NO VERIFICADA");
    return;
  }
  await verifyCommercialExportSources(root, files);
  const destination = resolve(options.out);
  const physicalRoot = await realpath(root);
  const physicalParent = await realpath(dirname(destination));
  const physicalRelative = relative(physicalRoot, physicalParent);
  if (physicalRelative === "" || (physicalRelative !== ".." &&
    !physicalRelative.startsWith(`..${sep}`) && !isAbsolute(physicalRelative))) {
    throw new Error("La salida comercial apunta al repositorio mediante su directorio de destino");
  }
  await mkdir(destination, { recursive: false });
  try {
    for (const entry of files) await writeFile(join(destination, entry.name), entry.content, { flag: "wx" });
    await verifyCommercialExportDirectory(destination, files);
    await verifyCommercialExportSources(root, files);
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
  printCommandHeader("EXPORTACIÓN COMERCIAL");
  printReportLine(`${files.length - 1} proveedores · entorno ${options.environment ?? "sin companyID"}`);
  printCommandSection("ARCHIVOS VERIFICADOS");
  for (const entry of files) printReportLine(`  ${entry.name} · ${entry.bytes} bytes`);
  printCommandDeliverable("DIRECTORIO COMERCIAL", destination);
  printCommandResult("Cuatro archivos comprobados; publicaciones y backend sin modificar");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCommercialExport(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("exportar:comercial", error);
    process.exitCode = 1;
  });
}

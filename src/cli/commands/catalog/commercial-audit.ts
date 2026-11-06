import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditCommercialCatalog } from "../../../commercial/export/commercial-audit.js";
import { printReportLine } from "../../reporting/terminal.js";
import { printCommercialAuditReport } from "../../reporting/commercial-audit.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildCommercialExportFiles } from "../../../commercial/export/commercial-export.js";
import { verifyCommercialExportDirectory, verifyCommercialExportSources, verifyCommercialExportZip } from "../../../commercial/export/commercial-export-verification.js";
import { verifyCommercialPackagePair } from "../../reporting/commercial-package-delivery.js";
import { lstat } from "node:fs/promises";
import { readZipArchive } from "../../../infrastructure/archive/zip.js";
import type { CommercialEnvironment } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { printCommandError } from "../../reporting/errors.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { renderCommercialCategoryTree } from "../../../commercial/diagnostics/commercial-category-tree.js";
import { analyzePresentationConsistency } from "../../../commercial/diagnostics/presentation-consistency.js";
import { originalSources } from "../../../infrastructure/filesystem/catalog/original-catalog-sources.js";
import { prepareImportBatch } from "../../../preparation/batch-identity.js";
import { assertCommercialPackageProviders, inspectCommercialPackage } from "../../../commercial/export/commercial-package-snapshot.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

const readCommercialManifestInZip = async (path: string): Promise<string> => {
  const entries = readZipArchive(await readFile(path));
  const manifest = entries.find((entry) => entry.name === "commercial-manifest.json");
  if (!manifest || !Buffer.from(manifest.data.toString("utf8"), "utf8").equals(manifest.data)) {
    throw new Error("ZIP comercial sin manifiesto UTF-8 válido");
  }
  return manifest.data.toString("utf8");
};

export const runCommercialAudit = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine("Uso: npm run auditar:comercial -- [--json|--arbol|--pendientes|--revision|--muestras|--atributos|--atributos-revision|--atributos-vacios|--atributo=ID|--contenido|--contenido-revision|--coherencia|--exportacion|--acreditacion|--acreditacion-json|--detalle|--verificar=RUTA [--informe=ZIP]|--ficha=REFERENCIA]\nAudita propuestas y acredita la integridad comercial contra publicaciones técnicas; --verificar compara archivos ya exportados con el corte vigente, sin modificar datos.");
    return;
  }
  const verifyPath = args.find((arg) => arg.startsWith("--verificar="))?.match(/^--verificar=(.+)$/u)?.[1];
  const reportPath = args.find((arg) => arg.startsWith("--informe="))?.match(/^--informe=(.+)$/u)?.[1];
  if (reportPath !== undefined && verifyPath === undefined) throw new Error("--informe requiere --verificar=ZIP");
  if (verifyPath !== undefined) {
    if (args.length !== (reportPath === undefined ? 1 : 2) ||
      args.some((arg) => !arg.startsWith("--verificar=") && !arg.startsWith("--informe=")) ||
      args.filter((arg) => arg.startsWith("--verificar=")).length !== 1 ||
      args.filter((arg) => arg.startsWith("--informe=")).length > 1) {
      throw new Error("Opciones de verificación comercial inválidas");
    }
  }
  const attributeId = args[0]?.match(/^--atributo=([1-9]\d*)$/)?.[1];
  const productReference = args[0]?.match(/^--ficha=(.+)$/u)?.[1];
  if ((verifyPath === undefined && args.length > 1) || (args.length === 1 &&
    !["--json", "--arbol", "--pendientes", "--revision", "--muestras", "--atributos", "--atributos-revision", "--atributos-vacios", "--contenido", "--contenido-revision", "--coherencia", "--exportacion", "--acreditacion", "--acreditacion-json", "--detalle"].includes(args[0] ?? "") &&
    (attributeId === undefined || !Number.isSafeInteger(Number(attributeId))) && !productReference && !verifyPath)) {
    throw new Error("Opciones inválidas. Consultar --help para las opciones de auditoría comercial");
  }
  if (verifyPath !== undefined) {
    const path = resolve(verifyPath);
    const info = await lstat(path);
    if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) {
      throw new Error("--verificar requiere un directorio o ZIP regular");
    }
    if (reportPath !== undefined && !info.isFile()) {
      throw new Error("--informe solo puede acompañar a un ZIP comercial");
    }
    const text = info.isDirectory() ? await readFile(join(path, "commercial-manifest.json"), "utf8") :
      await readCommercialManifestInZip(path);
    const manifest: unknown = JSON.parse(text);
    if (!manifest || typeof manifest !== "object" || !("environment" in manifest) ||
      (manifest.environment !== null && manifest.environment !== "develop" && manifest.environment !== "production")) {
      throw new Error("El manifiesto comercial no tiene un entorno válido");
    }
    const environment: CommercialEnvironment | null = manifest.environment;
    const files = await buildCommercialExportFiles(root, environment);
    if (info.isFile()) assertCommercialPackageProviders(inspectCommercialPackage(files));
    const result = info.isDirectory() ? await verifyCommercialExportDirectory(path, files) :
      await verifyCommercialExportZip(path, files);
    if (reportPath !== undefined) await verifyCommercialPackagePair(path, reportPath, files);
    await verifyCommercialExportSources(root, files);
    printReportLine(`EXPORTACIÓN COMERCIAL ACREDITADA | ${result.files} archivos | ${result.bytes} bytes | entorno ${environment ?? "sin companyID"}${reportPath === undefined ? "" : " | informe coincidente"}`);
    return;
  }
  if (args[0] === "--coherencia") {
    const catalog = await loadImportCatalog();
    const products = [];
    for (const providerId of ["gam", "gomariz", "mercaeleva"]) {
      const sources = await originalSources(root, providerId);
      if (!sources) throw new Error(`Catálogo original no disponible: ${providerId}`);
      products.push(...prepareImportBatch([...sources.values()], catalog).products.map((item) => item.product));
    }
    const result = analyzePresentationConsistency(products);
    printReportLine(`COHERENCIA DE PREPARACIÓN | ${result.products} fichas | ${result.defects} defectos | ${result.reviews} casos para revisar`);
    for (const finding of result.findings) {
      printReportLine(`  ${finding.status.toUpperCase()} ${finding.providerId}:${finding.reference ?? finding.sourceUrl} | ${finding.field} | ${finding.code}`);
    }
    if (result.defects > 0) process.exitCode = 1;
    return;
  }
  const report = await auditCommercialCatalog(root);
  if (args[0] === "--arbol") {
    const catalog = await loadImportCatalog();
    const lines = renderCommercialCategoryTree(catalog.categories, report.providers.map(({ baseline, presentationAudit }) => ({
      providerId: baseline.providerId, decisions: presentationAudit.decisions
    })));
    for (const line of lines) printReportLine(line);
    return;
  }
  printCommercialAuditReport(report, args[0], attributeId, productReference);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCommercialAudit(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("auditar:comercial", error);
    process.exitCode = 1;
  });
}

import { printReportLine } from "../../reporting/terminal.js";
import { createHash } from "node:crypto";
import { LiveStatus, formatDuration } from "../../reporting/live-status.js";
import { printCommandError } from "../../reporting/errors.js";
import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exportHelp, parseExportOptions } from "../../options/export.js";
import { createProductsXlsx } from "../../../infrastructure/spreadsheet/xlsx.js";
import { prepareCreateManyExport, prepareExport } from "../../../pipeline/legacy-export/prepare-export.js";

export const runExport = async (args: readonly string[]): Promise<void> => {
  const options = parseExportOptions(args);
  if (options === "help") {
    printReportLine(exportHelp);
    return;
  }
  if (!options.preparation.endsWith("-preparation.json")) {
    throw new Error("Debe seleccionarse un archivo -preparation.json publicado, nunca un informe parcial");
  }
  const status = new LiveStatus();
  const startedAt = Date.now();
  status.update(`EXPORTACIÓN | ${options.providerId.toUpperCase()} | validando publicación | ${options.preparation}`);
  try {
    const prepared = options.format === "json"
      ? await prepareCreateManyExport(options.providerId, options.companyID, options.preparation, options.inventory, options.allowEmptyInventory, options.source)
      : await prepareExport(options.providerId, options.companyID, options.preparation, options.inventory, options.allowEmptyInventory, options.source);
    const { plan, report, inventoryReferences } = prepared;
    status.stop();
    printReportLine(`EXPORTACIÓN | ${options.providerId.toUpperCase()} | ${options.dryRun ? "SIMULACIÓN" : "PLAN DE ALTAS"} | ${options.format.toUpperCase()}`);
    printReportLine(`  Altas: ${plan.report.newProducts} | Existentes: ${plan.report.existingProducts} | Revisar: ${plan.report.reviewProducts} | Duplicados: ${plan.report.duplicateReferences}`);
    const newMachines = "products" in plan
      ? plan.products.filter((product) => product.condition === "Nuevo").length
      : plan.rows.filter((row) => row[plan.headers.indexOf("Condición *")] === "Nuevo").length;
    const usedMachines = plan.report.newProducts - newMachines;
    printReportLine(`  Condiciones de las altas: Nuevo: ${newMachines} | Segunda_Mano: ${usedMachines}`);
    printReportLine(`  Inventario: ${inventoryReferences} referencias`);
    if (args.includes("--verbose")) console.log(JSON.stringify(report, null, 2));
    if (options.dryRun) {
      printReportLine(`  Duración: ${formatDuration(Date.now() - startedAt)}`);
      return;
    }
    status.update(`EXPORTACIÓN | ${options.providerId.toUpperCase()} | generando archivo | ${options.out}`);
    const reportFile = `${options.out}.report.json`;
    if (plan.report.newProducts === 0) {
      await writeFile(reportFile, JSON.stringify({ ...report, format: options.format, outputSha256: null, outputBytes: 0 }, null, 2), { flag: "wx" });
      status.stop();
      printReportLine(`No hay altas nuevas seguras: informe guardado en ${reportFile}, sin archivo vacío.`);
      return;
    }
    const buffer = "products" in plan
      ? Buffer.from(JSON.stringify({ products: plan.products }, null, 2), "utf8")
      : createProductsXlsx(plan.headers, plan.rows);
    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error("El archivo supera el límite de 10 MB del backend; dividir las altas en lotes revisados");
    }
    await writeFile(options.out, buffer, { flag: "wx" });
    try {
      await writeFile(reportFile, JSON.stringify({
        ...report, format: options.format,
        outputSha256: createHash("sha256").update(buffer).digest("hex"),
        outputBytes: buffer.length
      }, null, 2), { flag: "wx" });
    } catch (error) {
      await rm(options.out, { force: true });
      throw error;
    }
    status.stop();
    printReportLine(`Archivo de altas generado: ${options.out} (${plan.report.newProducts} productos)`);
    printReportLine(`Informe generado: ${reportFile}`);
    printReportLine(`  Duración: ${formatDuration(Date.now() - startedAt)}`);
  } finally {
    status.stop();
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runExport(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("export", error);
    process.exitCode = 1;
  });
}

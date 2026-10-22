import { LiveStatus, formatDuration } from "./reporting/live-status.js";
import { printCommandError } from "./reporting/errors.js";
import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exportHelp, parseExportOptions } from "./options/export.js";
import { createProductsXlsx } from "../infrastructure/spreadsheet/xlsx.js";
import { prepareExport } from "../pipeline/export/prepare-export.js";

export const runExport = async (args: readonly string[]): Promise<void> => {
  const options = parseExportOptions(args);
  if (options === "help") {
    console.log(exportHelp);
    return;
  }
  if (!options.preparation.endsWith("-preparation.json")) {
    throw new Error("Debe seleccionarse un archivo -preparation.json publicado, nunca un informe parcial");
  }
  const status = new LiveStatus();
  const startedAt = Date.now();
  status.update(`EXPORTACIÓN | ${options.providerId.toUpperCase()} | validando publicación | ${options.preparation}`);
  try {
  const { plan, report, inventoryReferences } = await prepareExport(
    options.providerId, options.companyID, options.preparation, options.inventory, options.allowEmptyInventory, options.source
  );
  status.stop();
  console.log(`EXPORTACIÓN | ${options.providerId.toUpperCase()} | ${options.dryRun ? "SIMULACIÓN" : "PLAN DE ALTAS"}`);
  const conditionColumn = plan.headers.indexOf("Condición *");
  const newMachines = plan.rows.filter((row) => row[conditionColumn] === "Nuevo").length;
  const usedMachines = plan.rows.filter((row) => row[conditionColumn] === "Segunda_Mano").length;
  console.log(`  Altas: ${plan.report.newProducts} | Existentes: ${plan.report.existingProducts} | Revisar: ${plan.report.reviewProducts} | Duplicados: ${plan.report.duplicateReferences}`);
  console.log(`  Condiciones de las altas: Nuevo: ${newMachines} | Segunda_Mano: ${usedMachines}`);
  console.log(`  Inventario: ${inventoryReferences} referencias`);
  if (args.includes("--verbose")) console.log(JSON.stringify(report, null, 2));
  if (options.dryRun) {
    console.log(`  Duración: ${formatDuration(Date.now() - startedAt)}`);
    return;
  }
  status.update(`EXPORTACIÓN | ${options.providerId.toUpperCase()} | generando archivo | ${options.out}`);
  const reportFile = `${options.out}.report.json`;
  if (plan.rows.length === 0) {
    await writeFile(reportFile, JSON.stringify(report, null, 2), { flag: "wx" });
    status.stop();
    console.log(`No hay altas nuevas seguras: informe guardado en ${reportFile}, sin Excel vacío.`);
    return;
  }
  const buffer = createProductsXlsx(plan.headers, plan.rows);
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("El archivo supera el límite de 10 MB del backend; dividir las altas en lotes revisados");
  }
  await writeFile(options.out, buffer, { flag: "wx" });
  try {
    await writeFile(reportFile, JSON.stringify(report, null, 2), { flag: "wx" });
  } catch (error) {
    await rm(options.out, { force: true });
    throw error;
  }
  status.stop();
  console.log(`Excel de altas generado: ${options.out} (${plan.rows.length} productos)`);
  console.log(`Informe generado: ${reportFile}`);
  console.log(`  Duración: ${formatDuration(Date.now() - startedAt)}`);
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

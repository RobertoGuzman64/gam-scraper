import { LiveStatus, formatDuration } from "./reporting/live-status.js";
import { printCommandError } from "./reporting/errors.js";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getProvider } from "../scraping/registry.js";
import { loadImportCatalog } from "../catalog/import/catalog-loader.js";
import { planProductImport, readReferenceInventory } from "../catalog/import/export-plan.js";
import { parsePreparation } from "../catalog/import/preparation-document.js";
import { createProductsXlsx } from "../catalog/import/xlsx.js";
import { validateCatalogPublication } from "../pipeline/validation/preflight.js";

const help = `Uso: npm run export -- gam --companyID <ID real> --preparation <proveedor-preparation.json> --existing <inventario.csv> --out <salida.xlsx> [--dry-run | --confirm-inventory] [--allow-empty-inventory] [--verbose]

El inventario CSV debe contener companyID,reference y pertenecer a la misma compañía.
--dry-run no crea archivos; --confirm-inventory habilita la generación del XLSX.
El importador de Equipzilla SOLO crea productos, por eso se omiten referencias existentes.
El CSV debe ser un inventario completo y actualizado de la empresa en la base de datos de destino.`;

type ExportOptions = {
  readonly providerId: string;
  readonly companyID: number;
  readonly preparation: string;
  readonly inventory: string;
  readonly out: string;
  readonly dryRun: boolean;
  readonly confirmInventory: boolean;
  readonly allowEmptyInventory: boolean;
};

const parseOptions = (args: readonly string[]): ExportOptions | "help" => {
  if (args.length === 1 && args[0] === "--help") return "help";
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const valueFlags = new Set(["--provider", "--companyID", "--preparation", "--existing", "--out"]);
  const booleanFlags = new Set(["--dry-run", "--confirm-inventory", "--allow-empty-inventory", "--verbose"]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (index === 0 && arg && !arg.startsWith("--")) {
      flags.add("--provider");
      values.set("--provider", arg);
      continue;
    }
    if (!arg || flags.has(arg) || (!valueFlags.has(arg) && !booleanFlags.has(arg))) {
      throw new Error(`Argumento desconocido o repetido: ${arg ?? ""}`);
    }
    flags.add(arg);
    if (booleanFlags.has(arg)) continue;
    const next = args[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`Falta valor para ${arg}`);
    values.set(arg, next);
    index += 1;
  }
  for (const flag of valueFlags) if (!values.has(flag)) throw new Error(`Falta ${flag}`);
  const providerId = values.get("--provider") ?? "";
  getProvider(providerId);
  const id = values.get("--companyID") ?? "";
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new Error("companyID debe ser un ID positivo real");
  const out = resolve(values.get("--out") ?? "");
  if (!out.toLowerCase().endsWith(".xlsx")) throw new Error("--out debe terminar en .xlsx");
  const dryRun = flags.has("--dry-run");
  const confirmInventory = flags.has("--confirm-inventory");
  if (dryRun && confirmInventory) throw new Error("--dry-run y --confirm-inventory son incompatibles");
  if (!dryRun && !confirmInventory) throw new Error("Para generar el archivo debe confirmar el inventario con --confirm-inventory");
  return {
    providerId, companyID: Number(id), preparation: resolve(values.get("--preparation") ?? ""),
    inventory: resolve(values.get("--existing") ?? ""), out, dryRun, confirmInventory,
    allowEmptyInventory: flags.has("--allow-empty-inventory")
  };
};

export const runExport = async (args: readonly string[]): Promise<void> => {
  const options = parseOptions(args);
  if (options === "help") {
    console.log(help);
    return;
  }
  if (!options.preparation.endsWith("-preparation.json")) {
    throw new Error("Debe seleccionarse un archivo -preparation.json publicado, nunca un informe parcial");
  }
  const status = new LiveStatus();
  const startedAt = Date.now();
  status.update(`EXPORTACIÓN | ${options.providerId.toUpperCase()} | validando publicación | ${options.preparation}`);
  try {
  const base = options.preparation.slice(0, -"-preparation.json".length);
  const summaryFile = `${base}-summary.json`;
  await validateCatalogPublication({
    providerId: options.providerId,
    outputDir: resolve(base, ".."),
    outputPrefix: base.split(/[\\/]/).at(-1) ?? "",
    maxAgeHours: 48
  });
  status.update(`EXPORTACIÓN | ${options.providerId.toUpperCase()} | leyendo preparación e inventario`);
  const [preparationJson, inventoryCsv, summaryRaw, catalog] = await Promise.all([
    readFile(options.preparation, "utf8"), readFile(options.inventory, "utf8"),
    readFile(summaryFile, "utf8"), loadImportCatalog()
  ]);
  const summary: unknown = JSON.parse(summaryRaw);
  if (!summary || typeof summary !== "object" || !("quality" in summary) ||
    !summary.quality || typeof summary.quality !== "object" ||
    !("status" in summary.quality) || summary.quality.status !== "complete" ||
    !("published" in summary.quality) || summary.quality.published !== true) {
    throw new Error("La última ejecución no publicó un catálogo completo o el informe de preparación está obsoleto");
  }
  const input: unknown = JSON.parse(preparationJson);
  const preparation = parsePreparation(input, options.providerId);
  const inventory = readReferenceInventory(inventoryCsv, options.companyID);
  if (inventory.references.size === 0 && !options.allowEmptyInventory) {
    throw new Error("Inventario vacío: revisar consulta de empresa o pasar --allow-empty-inventory si se ha comprobado que no existen productos");
  }
  status.update(`EXPORTACIÓN | ${options.providerId.toUpperCase()} | calculando altas y revisiones`);
  const plan = planProductImport(preparation, options.providerId, inventory, catalog);
  const report = {
    generatedAt: new Date().toISOString(),
    preparationFile: options.preparation,
    inventoryFile: options.inventory,
    inventoryReferences: inventory.references.size,
    ...plan.report
  };
  status.stop();
  console.log(`EXPORTACIÓN | ${options.providerId.toUpperCase()} | ${options.dryRun ? "SIMULACIÓN" : "PLAN DE ALTAS"}`);
  const conditionColumn = plan.headers.indexOf("Condición *");
  const newMachines = plan.rows.filter((row) => row[conditionColumn] === "Nuevo").length;
  const usedMachines = plan.rows.filter((row) => row[conditionColumn] === "Segunda_Mano").length;
  console.log(`  Altas: ${plan.report.newProducts} | Existentes: ${plan.report.existingProducts} | Revisar: ${plan.report.reviewProducts} | Duplicados: ${plan.report.duplicateReferences}`);
  console.log(`  Condiciones de las altas: Nuevo: ${newMachines} | Segunda_Mano: ${usedMachines}`);
  console.log(`  Inventario: ${inventory.references.size} referencias`);
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

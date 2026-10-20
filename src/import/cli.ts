import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getProvider } from "../scraper/providers/index.js";
import { loadImportCatalog } from "./prepare.js";
import { parsePreparation, planProductImport, readReferenceInventory } from "./export.js";
import { createProductsXlsx } from "./xlsx.js";
import { validateCatalogPublication } from "../validation/preflight.js";

const help = `Uso: npm run export:import -- --provider gam --companyID <ID real> --preparation <proveedor-preparation.json> --existing <inventario.csv> --out <salida.xlsx> [--dry-run | --confirm-inventory] [--allow-empty-inventory]

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
  const booleanFlags = new Set(["--dry-run", "--confirm-inventory", "--allow-empty-inventory"]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
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
  const base = options.preparation.slice(0, -"-preparation.json".length);
  const summaryFile = `${base}-summary.json`;
  await validateCatalogPublication({
    providerId: options.providerId,
    outputDir: resolve(base, ".."),
    outputPrefix: base.split(/[\\/]/).at(-1) ?? "",
    maxAgeHours: 48
  });
  const [preparationJson, inventoryCsv, summaryRaw, preparationStat, summaryStat, catalog] = await Promise.all([
    readFile(options.preparation, "utf8"), readFile(options.inventory, "utf8"),
    readFile(summaryFile, "utf8"), stat(options.preparation), stat(summaryFile), loadImportCatalog()
  ]);
  const summary: unknown = JSON.parse(summaryRaw);
  if (!summary || typeof summary !== "object" || !("quality" in summary) ||
    !summary.quality || typeof summary.quality !== "object" ||
    !("status" in summary.quality) || summary.quality.status !== "complete" ||
    !("published" in summary.quality) || summary.quality.published !== true ||
    summaryStat.mtimeMs > preparationStat.mtimeMs) {
    throw new Error("La última ejecución no publicó un catálogo completo o el informe de preparación está obsoleto");
  }
  const input: unknown = JSON.parse(preparationJson);
  const preparation = parsePreparation(input, options.providerId);
  const inventory = readReferenceInventory(inventoryCsv, options.companyID);
  if (inventory.references.size === 0 && !options.allowEmptyInventory) {
    throw new Error("Inventario vacío: revisar consulta de empresa o pasar --allow-empty-inventory si se ha comprobado que no existen productos");
  }
  const plan = planProductImport(preparation, options.providerId, inventory, catalog);
  const report = {
    generatedAt: new Date().toISOString(),
    preparationFile: options.preparation,
    inventoryFile: options.inventory,
    inventoryReferences: inventory.references.size,
    ...plan.report
  };
  console.log(JSON.stringify({ dryRun: options.dryRun, ...report, existing: report.existing.length,
    review: report.review.length, duplicates: report.duplicates.length }, null, 2));
  if (options.dryRun) return;
  const reportFile = `${options.out}.report.json`;
  if (plan.rows.length === 0) {
    await writeFile(reportFile, JSON.stringify(report, null, 2), { flag: "wx" });
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
  console.log(`Excel de altas generado: ${options.out} (${plan.rows.length} productos)`);
  console.log(`Informe generado: ${reportFile}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runExport(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

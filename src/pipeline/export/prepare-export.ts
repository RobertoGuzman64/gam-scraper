import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadImportCatalog } from "../../infrastructure/filesystem/import-catalog-loader.js";
import { planProductImport, readReferenceInventory } from "../../catalog/import/export/export-plan.js";
import { parsePreparation } from "../../catalog/import/preparation/preparation-document.js";
import { validateCatalogPublication } from "../validation/preflight.js";

export const prepareExport = async (
  providerId: string, companyID: number, preparationFile: string, inventoryFile: string, allowEmptyInventory: boolean
) => {
  const base = preparationFile.slice(0, -"-preparation.json".length);
  const summaryFile = `${base}-summary.json`;
  await validateCatalogPublication({
    providerId: providerId,
    outputDir: resolve(base, ".."),
    outputPrefix: base.split(/[\\/]/).at(-1) ?? "",
    maxAgeHours: 48
  });
  const [preparationJson, inventoryCsv, summaryRaw, catalog] = await Promise.all([
    readFile(preparationFile, "utf8"), readFile(inventoryFile, "utf8"),
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
  const preparation = parsePreparation(input, providerId);
  const inventory = readReferenceInventory(inventoryCsv, companyID);
  if (inventory.references.size === 0 && !allowEmptyInventory) {
    throw new Error("Inventario vacío: revisar consulta de empresa o pasar --allow-empty-inventory si se ha comprobado que no existen productos");
  }
  const plan = planProductImport(preparation, providerId, inventory, catalog);
  const report = {
    generatedAt: new Date().toISOString(),
    preparationFile: preparationFile,
    inventoryFile: inventoryFile,
    inventoryReferences: inventory.references.size,
    ...plan.report
  };
  return { plan, report, inventoryReferences: inventory.references.size };
};

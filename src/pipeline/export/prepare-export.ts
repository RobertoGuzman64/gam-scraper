import { access, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { getProvider } from "../../scraping/registry.js";
import { loadImportCatalog } from "../../infrastructure/filesystem/import-catalog-loader.js";
import { planProductImport, readReferenceInventory } from "../../catalog/import/export/export-plan.js";
import { parsePreparation } from "../../catalog/import/preparation/preparation-document.js";
import { offlinePreparationManifestPath } from "../../infrastructure/filesystem/offline-preparation.js";
import { validateCatalogPublication } from "../validation/preflight.js";
import { validateOfflinePreparation } from "../validation/offline.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const prepareExport = async (
  providerId: string, companyID: number, preparationFile: string, inventoryFile: string,
  allowEmptyInventory: boolean, sourceFile?: string
) => {
  const path = resolve(preparationFile);
  const base = path.slice(0, -"-preparation.json".length);
  let hasOfflineManifest = false;
  try {
    await access(offlinePreparationManifestPath(path));
    hasOfflineManifest = true;
  } catch (error) {
    if (!isRecord(error) || error.code !== "ENOENT") throw error;
  }
  let document;
  let catalog;
  let source: string;
  if (hasOfflineManifest || sourceFile !== undefined) {
    const provider = getProvider(providerId);
    const prefix = base.split(/[\\/]/).at(-1) ?? "";
    const canonicalFile = sourceFile ?? join(resolve(provider.defaultOptions.outDir), `${prefix}-catalog.json`);
    const verified = await validateOfflinePreparation(providerId, path, canonicalFile, 48);
    document = verified.preparation;
    catalog = verified.target;
    source = verified.catalog.sourceFile;
  } else {
    await validateCatalogPublication({
      providerId, outputDir: resolve(base, ".."),
      outputPrefix: base.split(/[\\/]/).at(-1) ?? "", maxAgeHours: 48
    });
    const [raw, summaryText, currentCatalog] = await Promise.all([
      readFile(path, "utf8"), readFile(`${base}-summary.json`, "utf8"), loadImportCatalog()
    ]);
    const summary: unknown = JSON.parse(summaryText);
    if (!isRecord(summary) || !isRecord(summary.quality) || summary.quality.status !== "complete" ||
      summary.quality.published !== true) throw new Error("La publicación heredada no está completa");
    const parsed: unknown = JSON.parse(raw);
    document = parsePreparation(parsed, providerId);
    catalog = currentCatalog;
    source = `${base}-summary.json`;
  }
  const inventoryCsv = await readFile(inventoryFile, "utf8");
  const inventory = readReferenceInventory(inventoryCsv, companyID);
  if (inventory.references.size === 0 && !allowEmptyInventory) {
    throw new Error("Inventario vacío: revisar consulta de empresa o pasar --allow-empty-inventory si se ha comprobado que no existen productos");
  }
  const plan = planProductImport(document, providerId, inventory, catalog);
  const report = {
    generatedAt: new Date().toISOString(),
    preparationFile: path, sourceFile: source, inventoryFile,
    inventoryReferences: inventory.references.size, ...plan.report
  };
  return { plan, report, inventoryReferences: inventory.references.size };
};

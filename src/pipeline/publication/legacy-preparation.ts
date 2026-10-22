import type { ProductRecord } from "../../contracts/catalog.js";
import { prepareImportBatch } from "../../catalog/import/preparation/prepare.js";
import { loadImportCatalog } from "../../infrastructure/filesystem/import-catalog-loader.js";

export const buildLegacyPreparation = async (
  products: readonly ProductRecord[],
  quality: "complete" | "partial" | "blocked",
  published: boolean
): Promise<string> => {
  const catalog = await loadImportCatalog();
  const preparation = prepareImportBatch(products, catalog);
  return JSON.stringify({ quality, published, ...preparation }, null, 2);
};

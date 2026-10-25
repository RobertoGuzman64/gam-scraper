import { fileURLToPath } from "node:url";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { prepareCached } from "./prepare-cached.js";
import { requireProductReference } from "./require-product-reference.js";

export const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog(fileURLToPath(new URL(
  "../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url
)));

export const reference = (code: string): ProductRecord => requireProductReference(source.products, code);

export const categorySlug = (record: ProductRecord): string | null => {
  const prepared = prepareCached(record, catalog);
  return catalog.categories.find((category) => category.id === prepared.product.categorySellID)?.slug ?? null;
};

export const unconfirmedConditionCodes = [
  "6358", "6367", "6814", "6815", "6969", "6970", "6971", "6987", "6988", "6989"
] as const;

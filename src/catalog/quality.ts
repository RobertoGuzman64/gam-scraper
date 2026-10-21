import type { CategoryScrapeResult } from "../contracts/scraping.js";
import type { ProductRecord } from "../contracts/catalog.js";
import type { CatalogSnapshot } from "./snapshot.js";

export type { CatalogItem, CatalogSnapshot, CatalogChanges } from "./snapshot.js";
export { categoryScope, buildCatalogItems, compareCatalog, parseCatalogSnapshot } from "./snapshot.js";
export { findIdentityConflicts, findSerialNumberCollisions, describeSerialNumberCollision } from "./identity-conflicts.js";
export { validateScrapedProduct } from "./product-validation.js";

export type CatalogQuality = {
  readonly status: "complete" | "partial" | "blocked";
  readonly reasons: readonly string[];
  readonly published: boolean;
};

export const assessCatalogQuality = (
  results: readonly CategoryScrapeResult[],
  products: readonly ProductRecord[],
  previous: CatalogSnapshot | null,
  identityConflicts: readonly string[] = [],
  serialWarnings: readonly string[] = []
): CatalogQuality => {
  const reasons: string[] = [...identityConflicts];
  if (results.length === 0) reasons.push("No hay categorías procesadas");
  if (products.length === 0) reasons.push("Catálogo sin productos válidos");

  for (const result of results) {
    if (result.products.length === 0) reasons.push(`Categoría sin productos: ${result.category.key}`);
    if (result.failures.length > 0) reasons.push(`Errores de extracción en ${result.category.key}: ${result.failures.length}`);
    if (result.expectedProductUrls !== undefined && result.discoveredProductUrls !== result.expectedProductUrls) {
      reasons.push(`Cobertura incompleta en ${result.category.key}: ${result.discoveredProductUrls} de ${result.expectedProductUrls} referencias`);
    }
  }

  if (previous && previous.items.length >= 10 && products.length < previous.items.length / 2) {
    reasons.push(`Caída anómala del catálogo: ${previous.items.length} → ${products.length}`);
  }

  const blocked = identityConflicts.length > 0 || results.length === 0 || products.length === 0 || results.some((r) => r.products.length === 0)
    || (previous !== null && previous.items.length >= 10 && products.length < previous.items.length / 2);
  const status = blocked ? "blocked" : reasons.length > 0 ? "partial" : "complete";
  return { status, reasons: [...reasons, ...serialWarnings.map((warning) => `Advertencia: ${warning}`)], published: status === "complete" };
};


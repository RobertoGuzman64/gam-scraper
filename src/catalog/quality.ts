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
  let invalidExclusions = false;
  if (results.length === 0) reasons.push("No hay categorías procesadas");
  if (products.length === 0) reasons.push("Catálogo sin productos válidos");

  for (const result of results) {
    if (result.products.length === 0) reasons.push(`Categoría sin productos: ${result.category.key}`);
    if (result.exclusions?.length) {
      const excludedUrls = new Set(result.exclusions.map((entry) => entry.url));
      const productUrls = new Set(result.products.map((entry) => entry.url));
      if (excludedUrls.size !== result.exclusions.length ||
        result.exclusions.some((entry) => !entry.url || !entry.reason.trim() || productUrls.has(entry.url))) {
        invalidExclusions = true;
        reasons.push(`Exclusiones de fichas incoherentes en ${result.category.key}`);
      }
      if (result.failures.length === 0 && result.products.length + result.exclusions.length !== result.discoveredProductUrls) {
        invalidExclusions = true;
        reasons.push(`Cobertura de fichas no conciliada en ${result.category.key}`);
      }
    }
    if (result.failures.length > 0) reasons.push(`Errores de extracción en ${result.category.key}: ${result.failures.length}`);
    if (result.expectedProductUrls !== undefined && result.discoveredProductUrls !== result.expectedProductUrls) {
      reasons.push(`Cobertura incompleta en ${result.category.key}: ${result.discoveredProductUrls} de ${result.expectedProductUrls} referencias`);
    }
  }

  const observedCount = products.length + results.reduce((count, result) => count + (result.exclusions?.length ?? 0), 0);
  const previousCount = previous?.items.length ?? 0;
  const abnormalDrop = previousCount >= 10 && observedCount < previousCount / 2;
  if (abnormalDrop) reasons.push(`Caída anómala sin justificar: ${previousCount} → ${observedCount}`);

  const blocked = invalidExclusions || identityConflicts.length > 0 || results.length === 0 || products.length === 0 || results.some((r) => r.products.length === 0)
    || abnormalDrop;
  const status = blocked ? "blocked" : reasons.length > 0 ? "partial" : "complete";
  return { status, reasons: [...reasons, ...serialWarnings.map((warning) => `Advertencia: ${warning}`)], published: status === "complete" };
};


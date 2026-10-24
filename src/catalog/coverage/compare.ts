import type { CanonicalCatalog } from "../canonical-catalog.js";
import { buildProductIdentity } from "../identity.js";
import { buildCatalogItems, compareCatalog } from "../snapshot.js";
import type { ProductRecord } from "../../contracts/catalog.js";

export type CoverageDifference = {
  readonly previousCount: number;
  readonly currentCount: number;
  readonly missing: readonly ProductRecord[];
  readonly added: readonly ProductRecord[];
  readonly changed: number;
  readonly changedDetails: readonly {
    readonly reference: string | null;
    readonly title: string | null;
    readonly url: string;
    readonly fields: readonly string[];
  }[];
};

const changedFields = (previous: ProductRecord, current: ProductRecord): readonly string[] => {
  const fields = new Set([...Object.keys(previous), ...Object.keys(current)]);
  fields.delete("scrapedAt");
  fields.delete("specs");
  const differences = [...fields].filter((field) =>
    JSON.stringify(previous[field as keyof ProductRecord]) !== JSON.stringify(current[field as keyof ProductRecord]));
  const previousSpecs = previous.specs ?? {};
  const currentSpecs = current.specs ?? {};
  for (const field of new Set([...Object.keys(previousSpecs), ...Object.keys(currentSpecs)])) {
    if (JSON.stringify(previousSpecs[field]) !== JSON.stringify(currentSpecs[field])) {
      differences.push(`specs.${field}`);
    }
  }
  return differences.sort((a, b) => a.localeCompare(b));
};

export const compareCanonicalCoverage = (
  baseline: CanonicalCatalog, current: CanonicalCatalog
): CoverageDifference => {
  if (baseline.providerId !== current.providerId || baseline.scope !== current.scope) {
    throw new Error("Cobertura no comparable: proveedor o ámbito de extracción distinto");
  }
  const changes = compareCatalog({
    version: 1, scope: baseline.scope, createdAt: baseline.endedAt,
    items: buildCatalogItems(baseline.products)
  }, buildCatalogItems(current.products));
  const missing = new Set(changes.suspectedMissing);
  const added = new Set(changes.added);
  const previousByKey = new Map(baseline.products.map((product) => [buildProductIdentity(product).key, product]));
  const changedKeys = new Set(changes.updated);
  const changedDetails = current.products.flatMap((product) => {
    const key = buildProductIdentity(product).key;
    if (!changedKeys.has(key)) return [];
    const previous = previousByKey.get(key);
    if (!previous) throw new Error(`Cambio sin referencia histórica: ${key}`);
    const fields = changedFields(previous, product);
    if (fields.length === 0) throw new Error(`Huella de cambio sin diferencias: ${key}`);
    return [{ reference: product.reference, title: product.title, url: product.url, fields }];
  });
  return {
    previousCount: changes.previousCount,
    currentCount: changes.currentCount,
    missing: baseline.products.filter((product) => missing.has(buildProductIdentity(product).key)),
    added: current.products.filter((product) => added.has(buildProductIdentity(product).key)),
    changed: changes.updated.length,
    changedDetails
  };
};

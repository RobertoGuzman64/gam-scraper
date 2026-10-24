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
  return {
    previousCount: changes.previousCount,
    currentCount: changes.currentCount,
    missing: baseline.products.filter((product) => missing.has(buildProductIdentity(product).key)),
    added: current.products.filter((product) => added.has(buildProductIdentity(product).key)),
    changed: changes.updated.length
  };
};

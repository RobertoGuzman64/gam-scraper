import type { CanonicalCatalog } from "../canonical-catalog.js";
import { parseCanonicalCatalog } from "../canonical-catalog.js";
import { buildProductIdentity } from "../identity.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import { isDeepStrictEqual } from "node:util";
import { readProposedField, writeProposedField } from "./values.js";
import type { InterventionSimulation } from "./simulation.js";

export const applyInterventionToCatalog = (
  source: CanonicalCatalog,
  simulation: InterventionSimulation
): CanonicalCatalog => {
  if (source.providerId !== simulation.providerId || source.prefix !== simulation.prefix ||
    source.scope !== simulation.scope || source.productCount !== simulation.analyzedProducts) {
    throw new Error("La simulación no corresponde al catálogo indicado");
  }

  const changes = new Map<string, typeof simulation.changes>();
  for (const change of simulation.changes) {
    const entries = changes.get(change.identity) ?? [];
    changes.set(change.identity, [...entries, change]);
  }
  const applied = new Set<string>();
  const products: ProductRecord[] = source.products.map((original) => {
    const identity = buildProductIdentity(original).key;
    const operations = changes.get(identity);
    if (!operations) return original;
    applied.add(identity);
    let product: ProductRecord = original;
    for (const operation of operations) {
      if (!isDeepStrictEqual(readProposedField(product, operation.field), operation.expected)) {
        throw new Error(`Valor anterior no coincide: ${identity} | ${operation.field}`);
      }
      product = writeProposedField(product, operation);
    }
    if (buildProductIdentity(product).key !== identity) throw new Error("Una intervención alteró la identidad del producto");
    return product;
  });
  if (applied.size !== simulation.affectedProducts) throw new Error("No se han aplicado todas las identidades del plan");
  const derived = parseCanonicalCatalog({ ...source, products });
  if (derived.productCount !== source.productCount) throw new Error("La intervención cambió el número de productos");
  return derived;
};

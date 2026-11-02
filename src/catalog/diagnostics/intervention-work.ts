import { isDeepStrictEqual } from "node:util";
import type { CanonicalCatalog } from "../canonical-catalog.js";
import { buildProductIdentity } from "../identity.js";
import type { InterventionSimulation } from "../interventions/simulation.js";
import { readProposedField } from "../interventions/values.js";
import type { ProductRecord } from "../../contracts/catalog.js";

export type InterventionWorkSummary = {
  readonly processedProducts: number;
  readonly transformedProducts: number;
  readonly technicalValuesTransformed: number;
  readonly descriptionsGenerated: number;
  readonly descriptionsTransformed: number;
  readonly titlesTransformed: number;
  readonly otherFieldsTransformed: number;
};

const indexProducts = (products: readonly ProductRecord[]): Map<string, ProductRecord> => {
  const indexed = new Map<string, ProductRecord>();
  for (const product of products) {
    const identity = buildProductIdentity(product).key;
    if (indexed.has(identity)) throw new Error(`Identidad duplicada en la medición: ${identity}`);
    indexed.set(identity, product);
  }
  return indexed;
};

export const measureAppliedIntervention = (
  source: CanonicalCatalog,
  derived: CanonicalCatalog,
  simulation: InterventionSimulation
): InterventionWorkSummary => {
  if (source.providerId !== derived.providerId || source.prefix !== derived.prefix ||
    source.scope !== derived.scope || source.productCount !== derived.productCount ||
    source.productCount !== simulation.analyzedProducts || source.providerId !== simulation.providerId) {
    throw new Error("Los catálogos no corresponden a la intervención medida");
  }
  const before = indexProducts(source.products);
  const after = indexProducts(derived.products);
  if (before.size !== source.productCount || after.size !== derived.productCount ||
    [...before.keys()].some((identity) => !after.has(identity))) {
    throw new Error("Las identidades de los catálogos no coinciden");
  }

  const transformed = new Set<string>();
  let technicalValuesTransformed = 0;
  let descriptionsGenerated = 0;
  let descriptionsTransformed = 0;
  let titlesTransformed = 0;
  let otherFieldsTransformed = 0;

  for (const change of simulation.changes) {
    const sourceProduct = before.get(change.identity);
    const derivedProduct = after.get(change.identity);
    if (!sourceProduct || !derivedProduct) throw new Error(`Identidad no encontrada: ${change.identity}`);
    const oldValue = readProposedField(sourceProduct, change.field);
    const newValue = readProposedField(derivedProduct, change.field);
    if (!isDeepStrictEqual(oldValue, change.expected) || !isDeepStrictEqual(newValue, change.next)) {
      throw new Error(`La intervención medida no coincide con el plan: ${change.identity} | ${change.field}`);
    }
    if (isDeepStrictEqual(oldValue, newValue)) continue;
    transformed.add(change.identity);
    if (change.field.startsWith("spec:")) technicalValuesTransformed += 1;
    else if (change.field === "shortDescription" || change.field === "longDescription") {
      if ((typeof oldValue !== "string" || !oldValue.trim()) && typeof newValue === "string" && newValue.trim()) {
        descriptionsGenerated += 1;
      } else descriptionsTransformed += 1;
    } else if (change.field === "title") titlesTransformed += 1;
    else otherFieldsTransformed += 1;
  }

  return {
    processedProducts: source.productCount,
    transformedProducts: transformed.size,
    technicalValuesTransformed,
    descriptionsGenerated,
    descriptionsTransformed,
    titlesTransformed,
    otherFieldsTransformed
  };
};

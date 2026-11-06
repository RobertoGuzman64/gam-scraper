import { isDeepStrictEqual } from "node:util";
import type { ProductRecord, SpecValue } from "../../contracts/catalog.js";
import type { OfflinePreparation } from "../../preparation/offline-document.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import { buildProductIdentity } from "../identity.js";
import { normalizeSpecsObject } from "../normalization/normalize-specs.js";

export type PreparationWorkSummary = {
  readonly processedProducts: number;
  readonly transformedProducts: number;
  readonly specificationsAdded: number;
  readonly specificationsRenamed: number;
  readonly specificationValuesFormatted: number;
  readonly specificationValuesChanged: number;
  readonly descriptionsGenerated: number;
  readonly descriptionsTransformed: number;
  readonly titlesTransformed: number;
};

type CanonicalSpec = { readonly key: string; readonly rawValue: SpecValue; readonly normalizedValue: unknown };

const meaningful = (value: string | null): string => value?.trim() ?? "";

const normalizedSpecs = (specs: Readonly<Record<string, SpecValue>> | undefined): Map<string, CanonicalSpec | null> => {
  const grouped = new Map<string, CanonicalSpec | null>();
  for (const [rawKey, rawValue] of Object.entries(specs ?? {})) {
    const result = normalizeSpecsObject({ [rawKey]: rawValue });
    const [canonical] = Object.entries(result.normalized);
    if (!canonical) continue;
    const [key, normalizedValue] = canonical;
    if (grouped.has(key)) grouped.set(key, null);
    else grouped.set(key, { key: rawKey, rawValue, normalizedValue });
  }
  return grouped;
};

const compareSpecs = (before: ProductRecord["specs"], after: Readonly<Record<string, SpecValue>>): {
  readonly added: number; readonly renamed: number; readonly formatted: number; readonly changed: number;
} => {
  const source = normalizedSpecs(before);
  const target = normalizedSpecs(after);
  let added = 0;
  let renamed = 0;
  let formatted = 0;
  let changed = 0;
  for (const [key, entry] of target) {
    if (entry === null) continue;
    if (!source.has(key)) {
      added += 1;
      continue;
    }
    const previous = source.get(key);
    if (!previous) continue;
    if (!isDeepStrictEqual(entry.normalizedValue, previous.normalizedValue)) {
      changed += 1;
    } else if (entry.key !== previous.key) {
      renamed += 1;
    } else if (!isDeepStrictEqual(entry.rawValue, previous.rawValue)) {
      formatted += 1;
    }
  }
  return { added, renamed, formatted, changed };
};

export type IdentifiedProduct = {
  readonly identity: string;
  readonly product: ImportCandidate;
};

export const measureIdentifiedProductWork = (
  sourceProducts: readonly ProductRecord[],
  products: readonly IdentifiedProduct[]
): { readonly summary: PreparationWorkSummary; readonly changedIdentities: ReadonlySet<string> } => {
  if (products.length > sourceProducts.length) {
    throw new Error("No se puede medir un destino con más productos que el origen");
  }
  const sourceByIdentity = new Map<string, ProductRecord>();
  for (const product of sourceProducts) {
    const identity = buildProductIdentity(product).key;
    if (sourceByIdentity.has(identity)) throw new Error(`Identidad duplicada en el origen de la medición: ${identity}`);
    sourceByIdentity.set(identity, product);
  }
  const seen = new Set<string>();
  const changedIdentities = new Set<string>();
  let specificationsAdded = 0;
  let specificationsRenamed = 0;
  let specificationValuesFormatted = 0;
  let specificationValuesChanged = 0;
  let descriptionsGenerated = 0;
  let descriptionsTransformed = 0;
  let titlesTransformed = 0;
  for (const { identity, product } of products) {
    if (seen.has(identity)) throw new Error("Identidad duplicada o ausente en la preparación medida");
    seen.add(identity);
    const source = sourceByIdentity.get(identity);
    if (!source) throw new Error(`Origen no resuelto para la preparación medida: ${identity}`);
    let changed = false;
    if (meaningful(source.title) !== meaningful(product.title)) {
      titlesTransformed += 1;
      changed = true;
    }
    for (const [previous, current] of [
      [source.shortDescription, product.description],
      [source.longDescription, product.description_general]
    ] as const) {
      const before = meaningful(previous);
      const after = meaningful(current);
      if (before === after) continue;
      if (!before && after) descriptionsGenerated += 1;
      else descriptionsTransformed += 1;
      changed = true;
    }
    const specs = compareSpecs(source.specs, product.spec);
    specificationsAdded += specs.added;
    specificationsRenamed += specs.renamed;
    specificationValuesFormatted += specs.formatted;
    specificationValuesChanged += specs.changed;
    if (specs.added + specs.renamed + specs.formatted + specs.changed > 0) changed = true;
    if (changed) changedIdentities.add(identity);
  }
  return {
    summary: {
      processedProducts: seen.size, transformedProducts: changedIdentities.size,
      specificationsAdded, specificationsRenamed, specificationValuesFormatted, specificationValuesChanged,
      descriptionsGenerated, descriptionsTransformed, titlesTransformed
    },
    changedIdentities
  };
};

export const measurePreparationWork = (
  sourceProducts: readonly ProductRecord[],
  preparation: Pick<OfflinePreparation, "identities" | "products">
): PreparationWorkSummary => {
  if (sourceProducts.length !== preparation.products.length ||
    preparation.identities.length !== preparation.products.length) {
    throw new Error("No se puede medir una preparación con cantidades de origen y destino distintas");
  }
  return measureIdentifiedProductWork(sourceProducts, preparation.products.map((prepared, index) => ({
    identity: preparation.identities[index] ?? "",
    product: prepared.product
  }))).summary;
};

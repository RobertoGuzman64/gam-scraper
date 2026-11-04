import { isDeepStrictEqual } from "node:util";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../legacy-export/contracts.js";
import { buildProductIdentity } from "../identity.js";
import { imageUrls, normalizePrice } from "../preparation/product-fields.js";
import { measureIdentifiedProductWork } from "./preparation-work.js";
import type { PreparationWorkSummary } from "./preparation-work.js";

export type PublishedWorkSummary = PreparationWorkSummary & {
  readonly originalProducts: number;
  readonly publishedProducts: number;
  readonly excludedProducts: number;
  readonly pricesChanged: number;
  readonly categoriesChanged: number;
  readonly conditionsChanged: number;
  readonly galleriesChanged: number;
};

const condition = (value: ProductRecord["condition"]): ImportCandidate["condition"] =>
  value === "Segunda mano" ? "Segunda_Mano" : value ?? null;

export const measurePublishedWork = (
  sourceProducts: readonly ProductRecord[],
  publishedProducts: readonly ImportCandidate[]
): PublishedWorkSummary => {
  const byUrl = new Map<string, ProductRecord>();
  for (const source of sourceProducts) {
    if (byUrl.has(source.url)) throw new Error(`Origen con URL duplicada: ${source.url}`);
    byUrl.set(source.url, source);
  }
  const matched = new Set<string>();
  const pairs: { readonly source: ProductRecord; readonly target: ImportCandidate; readonly identity: string }[] = [];
  for (const target of publishedProducts) {
    const source = byUrl.get(target.sourceUrl);
    if (!source || source.providerId !== target.providerId || source.reference !== target.reference) {
      throw new Error(`Publicación sin origen coincidente por URL y referencia: ${target.providerId}:${target.reference ?? target.sourceUrl}`);
    }
    const identity = buildProductIdentity(source).key;
    if (matched.has(identity)) throw new Error(`Identidad publicada duplicada: ${identity}`);
    matched.add(identity);
    pairs.push({ source, target, identity });
  }
  const { summary, changedIdentities } = measureIdentifiedProductWork(sourceProducts,
    pairs.map(({ identity, target }) => ({ identity, product: target })));
  const modified = new Set(changedIdentities);
  let pricesChanged = 0;
  let categoriesChanged = 0;
  let conditionsChanged = 0;
  let galleriesChanged = 0;
  for (const { source, target, identity } of pairs) {
    if (normalizePrice(source.price) !== target.price) {
      pricesChanged += 1;
      modified.add(identity);
    }
    if (source.categoryName.trim() !== (target.category ?? "").trim()) {
      categoriesChanged += 1;
      modified.add(identity);
    }
    if (condition(source.condition) !== target.condition) {
      conditionsChanged += 1;
      modified.add(identity);
    }
    if (!isDeepStrictEqual([...new Set(imageUrls(source))].sort(), [...new Set(target.images)].sort()) ||
      (source.image ?? null) !== (target.image ?? null)) {
      galleriesChanged += 1;
      modified.add(identity);
    }
  }
  return {
    ...summary,
    transformedProducts: modified.size,
    originalProducts: sourceProducts.length,
    publishedProducts: publishedProducts.length,
    excludedProducts: sourceProducts.length - publishedProducts.length,
    pricesChanged,
    categoriesChanged,
    conditionsChanged,
    galleriesChanged
  };
};

export type PublishedWorkProvider = {
  readonly providerId: string;
  readonly sourceSha256: string;
  readonly approvalSha256: string;
  readonly publicationSha256: string;
  readonly work: PublishedWorkSummary;
};

export type PublishedWorkReport = {
  readonly providers: readonly PublishedWorkProvider[];
  readonly total: PublishedWorkSummary;
};

const metrics: readonly (keyof PublishedWorkSummary)[] = [
  "processedProducts", "transformedProducts", "specificationsAdded", "specificationsRenamed",
  "specificationValuesFormatted", "specificationValuesChanged", "descriptionsGenerated",
  "descriptionsTransformed", "titlesTransformed", "originalProducts", "publishedProducts",
  "excludedProducts", "pricesChanged", "categoriesChanged", "conditionsChanged", "galleriesChanged"
];

export const aggregatePublishedWork = (providers: readonly PublishedWorkProvider[]): PublishedWorkReport => {
  if (providers.length === 0 || new Set(providers.map((item) => item.providerId)).size !== providers.length) {
    throw new Error("Informe de trabajo publicado: proveedores ausentes o duplicados");
  }
  const totals: Record<keyof PublishedWorkSummary, number> = {
    processedProducts: 0, transformedProducts: 0, specificationsAdded: 0,
    specificationsRenamed: 0, specificationValuesFormatted: 0, specificationValuesChanged: 0,
    descriptionsGenerated: 0, descriptionsTransformed: 0, titlesTransformed: 0,
    originalProducts: 0, publishedProducts: 0, excludedProducts: 0,
    pricesChanged: 0, categoriesChanged: 0, conditionsChanged: 0, galleriesChanged: 0
  };
  for (const provider of providers) {
    for (const key of metrics) totals[key] += provider.work[key];
  }
  return { providers, total: totals };
};

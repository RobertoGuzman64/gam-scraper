import type { PanelProviderId } from "../evidence/types.js";
import type { PanelExplorerProduct } from "./types.js";

export type ExplorerSort =
  "most-differences" | "fewest-original-specs" | "most-technical-additions" |
  "most-technical-changes" | "reference";

export type ExplorerSelection = {
  readonly providerId: PanelProviderId | "todos";
  readonly stage: PanelExplorerProduct["stage"] | "todos";
  readonly category: string;
  readonly query: string;
  readonly sort: ExplorerSort;
  readonly missingOriginalDescription: boolean;
  readonly missingOriginalShortDescription?: boolean;
  readonly missingOriginalGeneralDescription?: boolean;
  readonly withoutOriginalSpecs: boolean;
  readonly withTechnicalAdditions: boolean;
  readonly withTechnicalChanges?: boolean;
  readonly withTitleChanges?: boolean;
  readonly withEditorialChanges: boolean;
};

export type ExplorerProductMetrics = {
  readonly originalSpecs: number;
  readonly publishedSpecs: number;
  readonly technicalAdditions: number;
  readonly technicalChanges: number;
  readonly observedDifferences: number;
  readonly missingOriginalDescription: boolean;
  readonly missingOriginalShortDescription: boolean;
  readonly missingOriginalGeneralDescription: boolean;
  readonly titleChanges: boolean;
  readonly editorialChanges: boolean;
};

export type ExplorerIndexEntry = {
  readonly item: PanelExplorerProduct;
  readonly metrics: ExplorerProductMetrics;
  readonly searchableText: string;
};

const empty = (value: string | null): boolean => value === null || value.trim().length === 0;
export const normalizeExplorerText = (value: string): string => value.toLocaleLowerCase("es")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const explorerProductMetrics = (item: PanelExplorerProduct): ExplorerProductMetrics => ({
  originalSpecs: Object.keys(item.original?.specs ?? {}).length,
  publishedSpecs: Object.keys(item.published?.specs ?? {}).length,
  technicalAdditions: item.changes.filter((difference) => difference.group === "technical" && difference.change === "added").length,
  technicalChanges: item.changes.filter((difference) => difference.group === "technical" && difference.change === "changed").length,
  observedDifferences: item.changes.filter((difference) => difference.change === "added" ||
    difference.change === "changed" || difference.change === "removed").length,
  missingOriginalShortDescription: item.original !== null && empty(item.original.shortDescription),
  missingOriginalGeneralDescription: item.original !== null && empty(item.original.generalDescription),
  missingOriginalDescription: item.original !== null &&
    (empty(item.original.shortDescription) || empty(item.original.generalDescription)),
  titleChanges: item.original !== null && item.published !== null && item.changes.some((difference) =>
    difference.group === "content" && difference.field === "Título" &&
    difference.change !== "unchanged" && difference.change !== "ambiguous"),
  editorialChanges: item.changes.some((difference) => difference.group === "content" &&
    (difference.field === "Descripción corta" || difference.field === "Descripción general") &&
    difference.change !== "unchanged" && difference.change !== "ambiguous")
});

export const createExplorerIndex = (products: readonly PanelExplorerProduct[]): readonly ExplorerIndexEntry[] =>
  products.map((item) => ({
    item,
    metrics: explorerProductMetrics(item),
    searchableText: normalizeExplorerText([item.reference, item.identity, item.sourceUrl,
      item.original?.title, item.published?.title, item.commercial?.title]
      .filter((value): value is string => typeof value === "string").join(" "))
  }));

const ranking = (entry: ExplorerIndexEntry, sort: ExplorerSort): number => {
  if (sort === "fewest-original-specs") return entry.metrics.originalSpecs;
  if (sort === "most-technical-additions") return -entry.metrics.technicalAdditions;
  if (sort === "most-technical-changes") return -entry.metrics.technicalChanges;
  return -entry.metrics.observedDifferences;
};

const referenceOrder = (left: PanelExplorerProduct, right: PanelExplorerProduct): number =>
  (left.reference ?? "").localeCompare(right.reference ?? "", "es") ||
  left.providerId.localeCompare(right.providerId) || left.identity.localeCompare(right.identity);

export const selectExplorerProducts = (
  products: readonly PanelExplorerProduct[], selection: ExplorerSelection,
  index: readonly ExplorerIndexEntry[] = createExplorerIndex(products)
): readonly PanelExplorerProduct[] => {
  const query = normalizeExplorerText(selection.query.trim());
  const ranked = index.filter(({ item, metrics, searchableText }) => {
    if (selection.providerId !== "todos" && item.providerId !== selection.providerId ||
      selection.stage !== "todos" && item.stage !== selection.stage ||
      selection.category !== "todos" && item.category !== selection.category ||
      query && !searchableText.includes(query)) return false;
    return (!selection.missingOriginalDescription || metrics.missingOriginalDescription) &&
      (!selection.missingOriginalShortDescription || metrics.missingOriginalShortDescription) &&
      (!selection.missingOriginalGeneralDescription || metrics.missingOriginalGeneralDescription) &&
      (!selection.withoutOriginalSpecs || item.original !== null && metrics.originalSpecs === 0) &&
      (!selection.withTechnicalAdditions || metrics.technicalAdditions > 0) &&
      (!selection.withTechnicalChanges || metrics.technicalChanges > 0) &&
      (!selection.withTitleChanges || metrics.titleChanges) &&
      (!selection.withEditorialChanges || metrics.editorialChanges);
  });

  ranked.sort((left, right) => {
    if (selection.sort === "reference") return referenceOrder(left.item, right.item);
    const leftComparable = left.item.original !== null && left.item.published !== null;
    const rightComparable = right.item.original !== null && right.item.published !== null;
    if (leftComparable !== rightComparable) return leftComparable ? -1 : 1;
    if (!leftComparable) return referenceOrder(left.item, right.item);
    return ranking(left, selection.sort) - ranking(right, selection.sort) ||
      right.metrics.technicalAdditions - left.metrics.technicalAdditions ||
      left.metrics.originalSpecs - right.metrics.originalSpecs ||
      referenceOrder(left.item, right.item);
  });
  return ranked.map(({ item }) => item);
};

export const explorerStageCounts = (
  index: readonly ExplorerIndexEntry[], selection: ExplorerSelection
): Readonly<Record<PanelExplorerProduct["stage"] | "todos", number>> => {
  const matches = selectExplorerProducts([], { ...selection, stage: "todos", sort: "reference" }, index);
  return {
    todos: matches.length,
    commercial: matches.filter((item) => item.stage === "commercial").length,
    "commercial-excluded": matches.filter((item) => item.stage === "commercial-excluded").length,
    "editorial-excluded": matches.filter((item) => item.stage === "editorial-excluded").length
  };
};

export type ExplorerCategoryCounts = {
  readonly total: number;
  readonly counts: ReadonlyMap<string, number>;
};

export const explorerCategoryCounts = (
  index: readonly ExplorerIndexEntry[], selection: ExplorerSelection
): ExplorerCategoryCounts => {
  const matches = selectExplorerProducts([], { ...selection, category: "todos", sort: "reference" }, index);
  const counts = new Map<string, number>();
  for (const item of matches) {
    if (item.category !== null) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  return { total: matches.length, counts };
};

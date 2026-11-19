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
  readonly withoutOriginalSpecs: boolean;
  readonly withTechnicalAdditions: boolean;
  readonly withEditorialChanges: boolean;
};

export type ExplorerProductMetrics = {
  readonly originalSpecs: number;
  readonly publishedSpecs: number;
  readonly technicalAdditions: number;
  readonly technicalChanges: number;
  readonly observedDifferences: number;
  readonly missingOriginalDescription: boolean;
  readonly editorialChanges: boolean;
};

const empty = (value: string | null): boolean => value === null || value.trim().length === 0;
const normalize = (value: string): string => value.toLocaleLowerCase("es")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const explorerProductMetrics = (item: PanelExplorerProduct): ExplorerProductMetrics => ({
  originalSpecs: Object.keys(item.original?.specs ?? {}).length,
  publishedSpecs: Object.keys(item.published?.specs ?? {}).length,
  technicalAdditions: item.changes.filter((difference) => difference.group === "technical" && difference.change === "added").length,
  technicalChanges: item.changes.filter((difference) => difference.group === "technical" && difference.change === "changed").length,
  observedDifferences: item.changes.filter((difference) => difference.change === "added" ||
    difference.change === "changed" || difference.change === "removed").length,
  missingOriginalDescription: item.original !== null &&
    (empty(item.original.shortDescription) || empty(item.original.generalDescription)),
  editorialChanges: item.changes.some((difference) => difference.group === "content" &&
    (difference.field === "Descripción corta" || difference.field === "Descripción general") &&
    difference.change !== "unchanged" && difference.change !== "ambiguous")
});

type RankedProduct = { readonly item: PanelExplorerProduct; readonly metrics: ExplorerProductMetrics };

const ranking = (entry: RankedProduct, sort: ExplorerSort): number => {
  if (sort === "fewest-original-specs") return entry.metrics.originalSpecs;
  if (sort === "most-technical-additions") return -entry.metrics.technicalAdditions;
  if (sort === "most-technical-changes") return -entry.metrics.technicalChanges;
  return -entry.metrics.observedDifferences;
};

export const selectExplorerProducts = (
  products: readonly PanelExplorerProduct[], selection: ExplorerSelection
): readonly PanelExplorerProduct[] => {
  const query = normalize(selection.query.trim());
  const ranked = products.filter((item) => {
    if (selection.providerId !== "todos" && item.providerId !== selection.providerId ||
      selection.stage !== "todos" && item.stage !== selection.stage ||
      selection.category !== "todos" && item.category !== selection.category) return false;
    if (selection.sort !== "reference" && (!item.original || !item.published)) return false;
    if (query && !normalize([item.reference, item.identity, item.sourceUrl, item.original?.title,
      item.published?.title, item.commercial?.title].filter((value): value is string => typeof value === "string").join(" ")).includes(query)) return false;
    return true;
  }).map((item): RankedProduct => ({ item, metrics: explorerProductMetrics(item) }))
    .filter(({ item, metrics }) =>
      (!selection.missingOriginalDescription || metrics.missingOriginalDescription) &&
      (!selection.withoutOriginalSpecs || item.original !== null && metrics.originalSpecs === 0) &&
      (!selection.withTechnicalAdditions || metrics.technicalAdditions > 0) &&
      (!selection.withEditorialChanges || metrics.editorialChanges));

  ranked.sort((left, right) => selection.sort === "reference" ?
    (left.item.reference ?? "").localeCompare(right.item.reference ?? "", "es") ||
      left.item.providerId.localeCompare(right.item.providerId) || left.item.identity.localeCompare(right.item.identity) :
    ranking(left, selection.sort) - ranking(right, selection.sort) ||
      right.metrics.technicalAdditions - left.metrics.technicalAdditions ||
      left.metrics.originalSpecs - right.metrics.originalSpecs ||
      left.item.providerId.localeCompare(right.item.providerId) || left.item.identity.localeCompare(right.item.identity));
  return ranked.map(({ item }) => item);
};

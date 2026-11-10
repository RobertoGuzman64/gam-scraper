import type { CommercialBaselineInput } from "../diagnostics/commercial-baseline.js";
import { gamSourceYear } from "../../catalog/normalization/gam/year.js";
import { reconcileGamVerifiedUnitYear } from "../../preparation/gam/technical/reconciliation/gam-verified-unit-year.js";
import { decideCommercialCategory } from "./category-decision.js";
import { commercialToken, projectCommercialPresentation } from "./presentation-projection.js";

export const commercialUnitTitleSuffixes = (
  inputs: readonly CommercialBaselineInput[]
): ReadonlyMap<string, string> => {
  const groups = new Map<string, { input: CommercialBaselineInput; title: string }[]>();
  for (const input of inputs) {
    if (decideCommercialCategory(input.source, input.mapped.product.categorySellID).status === "excluded") continue;
    const title = projectCommercialPresentation(input.source, input.published, null).title;
    if (!title) continue;
    const key = commercialToken(title);
    const group = groups.get(key) ?? [];
    group.push({ input, title });
    groups.set(key, group);
  }
  const suffixes = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sourceYears = group.map(({ input }) => gamSourceYear(input.source) ?? "");
    const sourceYearCounts = new Map<string, number>();
    for (const year of sourceYears) sourceYearCounts.set(year, (sourceYearCounts.get(year) ?? 0) + 1);
    const years = group.map(({ input }) => gamSourceYear(reconcileGamVerifiedUnitYear(input.source)));
    const usableYears = years.filter((year) => year !== null && /^(?:19|20)\d{2}$/u.test(year));
    const yearDifferentiates = new Set(usableYears).size > 1 ||
      (usableYears.length > 0 && usableYears.length < group.length);
    const preliminary = group.map(({ title }, index) => {
      const year = years[index];
      return yearDifferentiates && year && /^(?:19|20)\d{2}$/u.test(year) &&
        !/(?:^|\D)(?:19|20)\d{2}(?:\D|$)/u.test(title) ? ` · Año ${year}` : "";
    });
    const counts = new Map<string, number>();
    for (let index = 0; index < group.length; index += 1) {
      const key = commercialToken(`${group[index]?.title ?? ""}${preliminary[index] ?? ""}`);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (let index = 0; index < group.length; index += 1) {
      const item = group[index];
      if (!item) continue;
      let suffix = preliminary[index] ?? "";
      const key = commercialToken(`${item.title}${suffix}`);
      if ((counts.get(key) ?? 0) > 1 || (sourceYearCounts.get(sourceYears[index] ?? "") ?? 0) > 1) {
        const reference = item.input.published.reference?.trim();
        if (reference && /^[\p{L}\p{N}][\p{L}\p{N}._/-]{0,39}$/u.test(reference) &&
          !commercialToken(item.title).split("-").includes(commercialToken(reference))) {
          suffix += ` · Ref. ${reference}`;
        }
      }
      if (suffix) suffixes.set(item.input.published.sourceUrl, suffix);
    }
  }
  return suffixes;
};

export const unresolvedCommercialTitleCollisions = (
  products: readonly { readonly title: string | null; readonly sourceUrl: string }[]
): ReadonlySet<string> => {
  const groups = new Map<string, string[]>();
  for (const product of products) {
    if (!product.title) continue;
    const key = commercialToken(product.title);
    const group = groups.get(key) ?? [];
    group.push(product.sourceUrl);
    groups.set(key, group);
  }
  return new Set([...groups.values()].filter((group) => group.length > 1).flat());
};

import type { ProductRecord } from "../../../../../contracts/catalog.js";

export const gamConditionEvidence = (record: ProductRecord): { readonly isNew: boolean; readonly isUsed: boolean } => {
  const gamCategory = record.providerId === "gam" ? record.categoryKey : "";
  const gamPath = record.providerId === "gam" ? (() => {
    try { return new URL(record.url).pathname.split("/").at(-2) ?? ""; }
    catch { return ""; }
  })() : "";
  const gamNewSection = /(?:^|-)nuev[oa]s?(?:-|$)/i.test(gamCategory) ||
    /(?:^|-)nuev[oa]s?(?:-|$)/i.test(gamPath);
  const gamUsedSection = /(?:segunda-mano|de-ocasion|de-ocasión)/i.test(`${gamCategory} ${gamPath}`);
  return { isNew: gamNewSection, isUsed: gamUsedSection };
};

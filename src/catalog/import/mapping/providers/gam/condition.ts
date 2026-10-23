import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";

export const gamConditionEvidence = (record: ProductRecord): { readonly isNew: boolean; readonly isUsed: boolean; readonly documentedUsed: boolean } => {
  const gamCategory = record.providerId === "gam" ? record.categoryKey : "";
  const gamPath = record.providerId === "gam" ? (() => {
    try { return new URL(record.url).pathname.split("/").at(-2) ?? ""; }
    catch { return ""; }
  })() : "";
  const gamNewSection = /(?:^|-)nuev[oa]s?(?:-|$)/i.test(gamCategory) ||
    /(?:^|-)nuev[oa]s?(?:-|$)/i.test(gamPath);
  const gamUsedSection = /(?:segunda-mano|de-ocasion|de-ocasión)/i.test(`${gamCategory} ${gamPath}`);
  const short = fold(record.shortDescription ?? "");
  const model = record.specs?.["Modelo"];
  const normalizedModel = typeof model === "string" ? fold(model) : "";
  const documentedUsed = record.providerId === "gam" && gamCategory === "manutencion" && gamPath === "barredoras" &&
    /\bbarredora\b/.test(fold(record.title ?? "")) && normalizedModel.length >= 4 &&
    fold(record.title ?? "").includes(normalizedModel) && short.includes(normalizedModel) &&
    /\bde segunda mano\b.*\bventa\b/.test(short) &&
    !/\b(?:nuev[oa]s?|sin estrenar)\b/.test(short);
  return { isNew: gamNewSection, isUsed: gamUsedSection || documentedUsed, documentedUsed };
};

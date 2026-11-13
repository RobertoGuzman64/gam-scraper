import { containsEditorialBrandModel } from "./editorial-identity-match.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialFamilyFromSourceGeneral, editorialFamilyName, editorialFamilyOf } from "./editorial-families.js";
import { resolveEditorialFacts } from "./editorial-facts.js";
import { resolveReusableEditorial } from "./editorial-composition.js";
import { resolveEditorialSource } from "./editorial-source.js";

const compact = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");
const escapePattern = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const sourceSummaryIdentity = (text: string): string | null => {
  const match = /^\s*➨\s*([\p{L}][\p{L}\d-]*)\s+([\p{L}\d.-]*\d[\p{L}\d.-]*)\b/iu.exec(text);
  return match?.[1] && match[2] ? `${match[1]} ${match[2]}` : null;
};

export const restoreCorroboratedEditorialIdentity = (
  source: ProductRecord, publishedTitle: string | null, publishedShort: string | null
): { readonly title: string | null; readonly short: string | null } | null => {
  const brand = source.brand?.trim();
  const model = source.model?.trim();
  const title = source.title?.trim();
  const summary = source.shortDescription?.trim();
  const general = source.longDescription?.trim();
  if (!source.reference || !brand || !model || !title || !summary || !general ||
    compact(String(source.specs?.Marca ?? "")) !== compact(brand) ||
    compact(String(source.specs?.Modelo ?? "")) !== compact(model) ||
    !publishedTitle && !publishedShort) return null;
  const titleCorrect = publishedTitle ? containsEditorialBrandModel(publishedTitle, brand, model) : true;
  const summaryCorrect = publishedShort ? containsEditorialBrandModel(publishedShort, brand, model) : true;
  if (titleCorrect && summaryCorrect || !containsEditorialBrandModel(general.slice(0, 550), brand, model)) return null;
  const announced = sourceSummaryIdentity(summary);
  const staleSummary = !summaryCorrect && announced && !containsEditorialBrandModel(announced, brand, model) &&
    !compact(general).includes(compact(announced)) &&
    compact(publishedShort ?? "").includes(compact(announced)) &&
    (containsEditorialBrandModel(title, brand, model) || compact(title).includes(compact(announced)));
  const oldTitle = publishedTitle ?? "";
  const oldTitleModel = new RegExp(`\\b${escapePattern(brand)}\\s+([\\p{L}\\d./-]*\\d[\\p{L}\\d.\\s/-]*)$`, "iu").exec(oldTitle);
  const staleModel = !titleCorrect && oldTitleModel?.[1] && compact(oldTitleModel[1]) !== compact(model) &&
    !compact(general).includes(compact(oldTitleModel[1]));
  const staleBoth = !titleCorrect && announced && !containsEditorialBrandModel(announced, brand, model) &&
    !compact(general).includes(compact(announced)) && compact(title).includes(compact(announced)) &&
    (staleSummary || summaryCorrect);
  if (!staleSummary && !staleModel && !staleBoth) return null;
  const family = editorialFamilyOf(title);
  if (!family || editorialFamilyFromSourceGeneral(general) !== family) return null;
  const label = editorialFamilyName(family);
  const canonicalTitle = `${label[0]?.toLocaleUpperCase("es") ?? ""}${label.slice(1)} ${brand} ${model}`;
  const candidate: ProductRecord = { ...source, title: canonicalTitle };
  if (!resolveEditorialSource(candidate)) return null;
  let path: string;
  try {
    const url = new URL(source.url);
    if (url.search || url.hash) return null;
    path = compact(url.pathname);
  } catch {
    return null;
  }
  if (!path.includes(compact(`${brand} ${model}`))) return null;
  const facts = resolveEditorialFacts(candidate);
  if (!facts || facts.family !== family) return null;
  const composed = resolveReusableEditorial(candidate, family);
  if (!composed.short || !containsEditorialBrandModel(composed.short, brand, model)) return null;
  const repairedTitle = titleCorrect ? null : staleModel && oldTitleModel?.[1] && oldTitleModel.index !== undefined
    ? `${oldTitle.slice(0, oldTitleModel.index)}${brand} ${model}` : staleBoth ? canonicalTitle : null;
  const repairedShort = staleSummary ? composed.short : null;
  return repairedTitle || repairedShort ? { title: repairedTitle, short: repairedShort } : null;
};

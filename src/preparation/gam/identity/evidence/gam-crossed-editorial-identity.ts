import type { ProductRecord } from "../../../../contracts/catalog.js";
import { containsEditorialBrandModel, containsEditorialIdentity } from "../../../shared/editorial/domain/editorial-identity-match.js";
import { verifiedEditorialUrl } from "../../../shared/editorial/domain/editorial-source-url.js";

const compact = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");
const escapePattern = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const sourceSummaryIdentity = (text: string): string | null => {
  const match = /^\s*➨\s*([\p{L}][\p{L}\d-]*)\s+([\p{L}\d.-]*\d[\p{L}\d.-]*)\b/iu.exec(text);
  return match?.[1] && match[2] ? `${match[1]} ${match[2]}` : null;
};

export const hasCrossedGamEditorialIdentity = (source: ProductRecord): boolean => {
  const brand = source.brand?.trim();
  const model = source.model?.trim();
  const title = source.title?.trim() ?? "";
  const summary = source.shortDescription?.trim() ?? "";
  const general = source.longDescription?.trim() ?? "";
  const reference = source.reference?.trim();
  if (source.providerId !== "gam" || !reference || !brand || !model || !title || !summary || !general ||
    compact(String(source.specs?.Marca ?? "")) !== compact(brand) ||
    compact(String(source.specs?.Modelo ?? "")) !== compact(model) ||
    [title, summary, general].some((value) => containsEditorialBrandModel(value, brand, model))) return false;
  const url = verifiedEditorialUrl(source.url, ["online.gamrentals.com"]);
  const path = url?.pathname.split("/").filter(Boolean);
  if (path?.length !== 3 || path[0] !== "es" || !path[2]?.startsWith(`${reference}-`)) return false;
  const announced = sourceSummaryIdentity(summary);
  if (!announced || !containsEditorialIdentity(announced, brand) ||
    !containsEditorialIdentity(title, announced) || containsEditorialIdentity(general, announced) ||
    !containsEditorialIdentity(general, brand)) return false;
  const sourceModel = new RegExp(`\\b${escapePattern(brand)}\\s+([\\p{L}\\d./-]*\\d[\\p{L}\\d./-]*)`, "iu").exec(general);
  return Boolean(sourceModel?.[1] && compact(sourceModel[1]) !== compact(model) &&
    !containsEditorialIdentity(general, model));
};


export const hasGamModelTitleDisagreement = (source: ProductRecord): boolean => {
  const brand = source.brand?.trim();
  const model = source.model?.trim();
  const title = source.title?.trim();
  if (source.providerId !== "gam" || !source.reference?.trim() || !brand || !model || !title ||
    compact(String(source.specs?.Marca ?? "")) !== compact(brand) ||
    compact(String(source.specs?.Modelo ?? "")) !== compact(model) ||
    !compact(title).includes(compact(brand)) || compact(title).includes(compact(model))) return false;
  const url = verifiedEditorialUrl(source.url, ["online.gamrentals.com"]);
  const path = url?.pathname.split("/").filter(Boolean);
  return Boolean(path?.length === 3 && path[0] === "es" && path[2]?.startsWith(`${source.reference}-`));
};

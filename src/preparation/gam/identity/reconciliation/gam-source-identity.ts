import type { ProductRecord } from "../../../../contracts/catalog.js";
import { fold } from "../../../shared/classification/mapping/attribute-utils.js";

const compact = (value: string): string => fold(value).replace(/[^a-z0-9]/gu, "");
const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const sourcePath = (record: ProductRecord): string | null => {
  if (record.providerId !== "gam" || !record.reference || !record.title || !record.shortDescription) return null;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      url.search || url.hash || parts.length !== 3 || parts[0] !== "es" ||
      !(parts[2] ?? "").startsWith(`${record.reference}-`)) return null;
    return compact(parts[2] ?? "");
  } catch {
    return null;
  }
};

const sourceModel = (record: ProductRecord, brand: string): string | null => {
  const title = record.title ?? "";
  const match = new RegExp(`\\b${escapeRegex(brand)}\\s+([\\p{L}\\d./()-]+(?:\\s+(?:MWB))?)\\s*$`, "iu").exec(title);
  return match?.[1]?.trim() ?? null;
};

const summaryIdentifies = (record: ProductRecord, brand: string, model: string): boolean => {
  const short = record.shortDescription?.trim() ?? "";
  const baseModel = model.split(/\s/u)[0] ?? "";
  if (!baseModel || baseModel.length < 3) return false;
  const prefix = new RegExp(`^➨\\s*${escapeRegex(brand)}\\s+${escapeRegex(baseModel)}(?=\\s|\\b)`, "iu");
  return prefix.test(short);
};

const titleWithVerifiedModel = (record: ProductRecord, path: string): ProductRecord => {
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  if (!brand || !model || compact(String(record.specs?.Modelo ?? "")) !== compact(model) ||
    !summaryIdentifies(record, brand, model) || !path.includes(compact(model)) ||
    !compact(record.longDescription ?? "").includes(compact(`${brand} ${model}`))) return record;
  const published = sourceModel(record, brand);
  if (!published || compact(published) === compact(model) ||
    compact(published).startsWith(compact(model)) || compact(model).startsWith(compact(published))) return record;
  const title = record.title ?? "";
  const at = title.lastIndexOf(published);
  if (at < 0 || at + published.length !== title.length) return record;
  return { ...record, title: `${title.slice(0, at)}${model}` };
};

const specsWithVerifiedModel = (record: ProductRecord, path: string): ProductRecord => {
  const brand = record.brand?.trim();
  const stale = record.model?.trim();
  if (!brand || !stale || compact(String(record.specs?.Modelo ?? "")) !== compact(stale)) return record;
  const published = sourceModel(record, brand);
  if (!published || compact(published) === compact(stale) ||
    compact(published).startsWith(compact(stale)) || compact(stale).startsWith(compact(published)) ||
    !path.includes(compact(published)) || !summaryIdentifies(record, brand, published)) return record;
  const description = compact(record.longDescription ?? "");
  if (description.includes(compact(stale))) return record;
  if (!description.includes(compact(`${brand} ${published}`))) return record;
  return { ...record, model: published, specs: { ...record.specs, Modelo: published } };
};

const specsWithVerifiedBrand = (record: ProductRecord, path: string): ProductRecord => {
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  const modelSpec = record.specs?.Modelo;
  const brandSpec = record.specs?.Marca;
  if (!brand || !model || typeof modelSpec !== "string" || typeof brandSpec !== "string" ||
    compact(modelSpec) !== compact(model) || compact(brandSpec) !== compact(brand)) return record;
  const titledBrand = /\b([\p{L}][\p{L}\d&-]+)\s+[\p{L}\d./()-]+\s*$/iu.exec(record.title ?? "")?.[1];
  if (!titledBrand || compact(titledBrand) === compact(brand) ||
    !path.includes(compact(titledBrand)) ||
    !summaryIdentifies(record, titledBrand, model) ||
    !compact(record.longDescription ?? "").includes(compact(`${titledBrand} ${model}`))) return record;
  return { ...record, brand: titledBrand, specs: { ...record.specs, Marca: titledBrand } };
};

export const reconcileGamSourceIdentity = (record: ProductRecord): ProductRecord => {
  const path = sourcePath(record);
  if (!path) return record;
  const branded = specsWithVerifiedBrand(record, path);
  const modeled = specsWithVerifiedModel(branded, path);
  return titleWithVerifiedModel(modeled, path);
};

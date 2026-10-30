import type { CategoryConfig, CategoryScrapeResult } from "../../contracts/scraping.js";

import type { SpecScalar, SpecValue, SpecsMap } from "../../contracts/catalog.js";
import { toCsv } from "../../shared/csv.js";

export const baseProductHeaders = [
  "categoryKey",
  "categoryName",
  "title",
  "shortDescription",
  "longDescription",
  "price",
  "reference",
  "brand",
  "model",
  "year",
  "location",
  "country",
  "horometer",
  "serialNumber",
  "image",
  "url",
  "specJson",
  "providerId",
  "imagesJson",
  "priceText",
  "condition",
  "breadcrumbsJson",
  "subcategory",
  "externalReference",
  "shortDescriptionHtml",
  "longDescriptionHtml",
  "technicalSheetUrl",
  "scrapedAt",
  "yearSource"
] as const;

const categoryHeaders = ["categoryKey", "categoryName", "categoryUrl"] as const;

type CategoryHeader = (typeof categoryHeaders)[number];
type CategoryCsvRow = Record<CategoryHeader, string>;

const normalizeSpecKey = (s: string): string => s.trim().replace(/\s+/g, " ").replace(/\s*:+\s*$/, "");

const specColumnName = (specKey: string): string => `spec__${specKey}`;

const specScalarToString = (v: SpecScalar): string => {
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

const specValueToString = (v: SpecValue): string => {
  if (Array.isArray(v)) return v.map(specScalarToString).join(" | ");
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return specScalarToString(v);
  return "";
};

const normalizeSpecs = (specs: SpecsMap): Record<string, SpecValue> => {
  const out: Record<string, SpecValue> = {};
  for (const [k, v] of Object.entries(specs)) out[normalizeSpecKey(k)] = v;
  return out;
};

export const listSpecKeys = (products: readonly { readonly specs?: SpecsMap }[]): string[] => {
  const set = new Set<string>();
  for (const p of products) {
    const specs = p.specs;
    if (!specs) continue;
    for (const k of Object.keys(specs)) set.add(normalizeSpecKey(k));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
};

export const buildProductHeaders = (specKeys: readonly string[]): readonly string[] => [
  ...baseProductHeaders,
  ...specKeys.map(specColumnName)
];

export const serializeCategoriesCsv = (categories: readonly CategoryConfig[]): string => {
  const rows = categories.map<CategoryCsvRow>((c) => ({
    categoryKey: c.key,
    categoryName: c.name,
    categoryUrl: c.url
  }));

  return toCsv(rows, categoryHeaders);
};

export const toProductRow = (
  category: CategoryConfig,
  p: CategoryScrapeResult["products"][number],
  specKeys: readonly string[]
): Record<string, string> => {
  const specs: SpecsMap = p.specs ?? {};
  const specsNorm = normalizeSpecs(specs);
  const specJson = JSON.stringify(specs) ?? "{}";

  const row: Record<string, string> = {
    categoryKey: category.key,
    categoryName: category.name,
    title: p.title ?? "",
    shortDescription: p.shortDescription ?? "",
    longDescription: p.longDescription ?? "",
    price: p.price ?? "",
    reference: p.reference ?? "",
    brand: p.brand ?? "",
    model: p.model ?? "",
    year: p.year ?? "",
    location: p.location ?? "",
    country: p.country ?? "",
    horometer: p.horometer ?? "",
    serialNumber: p.serialNumber ?? "",
    image: p.image ?? "",
    url: p.url,
    specJson,
    providerId: p.providerId,
    imagesJson: JSON.stringify(p.images ?? (p.image ? [p.image] : [])),
    priceText: p.priceText ?? "",
    condition: p.condition ?? "",
    breadcrumbsJson: JSON.stringify(p.breadcrumbs ?? []),
    subcategory: p.subcategory ?? "",
    externalReference: p.externalReference ?? "",
    shortDescriptionHtml: p.shortDescriptionHtml ?? "",
    longDescriptionHtml: p.longDescriptionHtml ?? "",
    technicalSheetUrl: p.technicalSheetUrl ?? "",
    scrapedAt: p.scrapedAt ?? "",
    yearSource: p.yearSource ?? ""
  };

  for (const k of specKeys) {
    const v = specsNorm[k];
    row[specColumnName(k)] = v === undefined ? "" : specValueToString(v);
  }

  return row;
};


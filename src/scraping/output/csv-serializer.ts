import type { CategoryConfig } from "../../contracts/scraping.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import { toCsv } from "../../shared/csv.js";

export const baseProductHeaders = [
  "categoryKey", "categoryName", "title", "providerId", "url", "reference",
  "shortDescription", "longDescription", "price", "priceText", "condition",
  "breadcrumbsJson", "subcategory", "externalReference", "shortDescriptionHtml",
  "longDescriptionHtml", "technicalSheetUrl", "scrapedAt", "yearSource", "brand",
  "model", "year", "location", "country", "horometer", "serialNumber", "image",
  "imagesJson", "specJson"
] as const;

const toText = (value: string | null | undefined): string => value ?? "";

const productRow = (product: ProductRecord): Record<string, string> => ({
  providerId: product.providerId,
  categoryKey: product.categoryKey,
  categoryName: product.categoryName,
  url: product.url,
  reference: toText(product.reference),
  title: toText(product.title),
  shortDescription: toText(product.shortDescription),
  longDescription: toText(product.longDescription),
  price: toText(product.price),
  priceText: toText(product.priceText),
  condition: toText(product.condition),
  breadcrumbsJson: JSON.stringify(product.breadcrumbs ?? []),
  subcategory: toText(product.subcategory),
  externalReference: toText(product.externalReference),
  shortDescriptionHtml: toText(product.shortDescriptionHtml),
  longDescriptionHtml: toText(product.longDescriptionHtml),
  technicalSheetUrl: toText(product.technicalSheetUrl),
  scrapedAt: toText(product.scrapedAt),
  yearSource: toText(product.yearSource),
  brand: toText(product.brand),
  model: toText(product.model),
  year: toText(product.year),
  location: toText(product.location),
  country: toText(product.country),
  horometer: toText(product.horometer),
  serialNumber: toText(product.serialNumber),
  image: toText(product.image),
  imagesJson: JSON.stringify(product.images ?? (product.image ? [product.image] : [])),
  specJson: JSON.stringify(product.specs ?? {})
});

export const serializeProductsCsv = (products: readonly ProductRecord[]): string =>
  toCsv(products.map(productRow), baseProductHeaders);

export const serializeCategoriesCsv = (categories: readonly CategoryConfig[]): string =>
  toCsv(categories.map(({ key, name, url }) => ({ categoryKey: key, categoryName: name, categoryUrl: url })),
    ["categoryKey", "categoryName", "categoryUrl"]);

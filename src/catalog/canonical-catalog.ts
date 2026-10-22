import type { ProductRecord } from "../contracts/catalog.js";
import { buildProductIdentity } from "./identity.js";

export type CanonicalCatalog = {
  readonly version: 1;
  readonly providerId: string;
  readonly prefix: string;
  readonly scope: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly quality: { readonly status: "complete"; readonly published: true };
  readonly productCount: number;
  readonly products: readonly ProductRecord[];
};

export type CanonicalCatalogManifest = {
  readonly version: 1;
  readonly providerId: string;
  readonly prefix: string;
  readonly scope: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly productCount: number;
  readonly catalogSha256: string;
};

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const nullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const specScalar = (value: unknown): value is string | number | boolean =>
  typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));

const validSpecs = (value: unknown): boolean =>
  isRecord(value) && Object.values(value).every((entry) =>
    specScalar(entry) || (Array.isArray(entry) && entry.every(specScalar)));

const requiredStrings = ["providerId", "categoryKey", "categoryName", "url"] as const;
const nullableFields = [
  "title", "shortDescription", "longDescription", "price", "reference", "brand", "model",
  "year", "location", "country", "horometer", "serialNumber", "image"
] as const;
const optionalNullableFields = [
  "priceText", "subcategory", "externalReference", "shortDescriptionHtml",
  "longDescriptionHtml", "technicalSheetUrl", "yearSource"
] as const;

const isProductRecord = (value: unknown): value is ProductRecord => {
  if (!isRecord(value) || !requiredStrings.every((field) => typeof value[field] === "string" && value[field].length > 0) ||
    !nullableFields.every((field) => Object.hasOwn(value, field) && nullableString(value[field])) ||
    !optionalNullableFields.every((field) => value[field] === undefined || nullableString(value[field])) ||
    (value.yearSource !== undefined && value.yearSource !== null && (typeof value.yearSource !== "string" || !["ficha", "descripcion", "titulo", "url"].includes(value.yearSource))) ||
    (value.condition !== undefined && value.condition !== null && value.condition !== "Nuevo" && value.condition !== "Segunda mano") ||
    (value.breadcrumbs !== undefined && (!Array.isArray(value.breadcrumbs) || !value.breadcrumbs.every((entry: unknown) => typeof entry === "string"))) ||
    (value.images !== undefined && (!Array.isArray(value.images) || !value.images.every((entry: unknown) => typeof entry === "string"))) ||
    (value.specs !== undefined && !validSpecs(value.specs)) ||
    (value.scrapedAt !== undefined && typeof value.scrapedAt !== "string")) return false;
  if (typeof value.url !== "string") return false;
  try { new URL(value.url); } catch { return false; }
  return true;
};

const validDate = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));

export const parseCanonicalCatalog = (value: unknown): CanonicalCatalog => {
  if (!isRecord(value) || value.version !== 1 || typeof value.providerId !== "string" || !value.providerId.trim() ||
    typeof value.prefix !== "string" || !/^[a-zA-Z0-9_-]+$/.test(value.prefix) ||
    typeof value.scope !== "string" || !/^[a-f0-9]{16}$/.test(value.scope) ||
    !validDate(value.startedAt) || !validDate(value.endedAt) || Date.parse(value.endedAt) < Date.parse(value.startedAt) ||
    !isRecord(value.quality) || value.quality.status !== "complete" || value.quality.published !== true ||
    !Number.isSafeInteger(value.productCount) || typeof value.productCount !== "number" || value.productCount < 1 ||
    !Array.isArray(value.products) || value.products.length !== value.productCount ||
    !value.products.every(isProductRecord)) throw new Error("Catálogo canónico incompleto o con contrato inválido");

  const keys = new Set<string>();
  for (const product of value.products) {
    if (product.providerId !== value.providerId) throw new Error("Catálogo canónico con proveedores mezclados");
    const identity = buildProductIdentity(product).key;
    if (keys.has(identity)) throw new Error(`Identidad duplicada en catálogo canónico: ${identity}`);
    keys.add(identity);
  }
  return value as CanonicalCatalog;
};

export const parseCanonicalManifest = (value: unknown): CanonicalCatalogManifest => {
  if (!isRecord(value) || value.version !== 1 || typeof value.providerId !== "string" || !value.providerId.trim() ||
    typeof value.prefix !== "string" || !/^[a-zA-Z0-9_-]+$/.test(value.prefix) ||
    typeof value.scope !== "string" || !/^[a-f0-9]{16}$/.test(value.scope) ||
    !validDate(value.startedAt) || !validDate(value.endedAt) ||
    typeof value.productCount !== "number" || !Number.isSafeInteger(value.productCount) || value.productCount < 1 ||
    typeof value.catalogSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.catalogSha256)) {
    throw new Error("Manifest del catálogo canónico inválido");
  }
  return value as CanonicalCatalogManifest;
};

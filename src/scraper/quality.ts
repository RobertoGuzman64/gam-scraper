import { createHash } from "node:crypto";
import { buildProductIdentity } from "./identity.js";
import type { CategoryConfig, CategoryScrapeResult, ProductRecord } from "./types.js";

export type CatalogItem = { readonly key: string; readonly fingerprint: string };

export type CatalogSnapshot = {
  readonly version: 1;
  readonly scope: string;
  readonly createdAt: string;
  readonly items: readonly CatalogItem[];
};

export type CatalogChanges = {
  readonly baseline: "new" | "previous";
  readonly previousCount: number;
  readonly currentCount: number;
  readonly added: readonly string[];
  readonly updated: readonly string[];
  readonly suspectedMissing: readonly string[];
};

export type CatalogQuality = {
  readonly status: "complete" | "partial" | "blocked";
  readonly reasons: readonly string[];
  readonly published: boolean;
};

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export const categoryScope = (categories: readonly CategoryConfig[], mode: "flat" | "grouped" = "flat"): string =>
  digest(JSON.stringify({ mode, categories: categories.map(({ key, url }) => ({ key, url })).sort((a, b) =>
    `${a.key}:${a.url}`.localeCompare(`${b.key}:${b.url}`)) })).slice(0, 16);

export const validateScrapedProduct = (product: ProductRecord): void => {
  if (!product.title?.trim()) throw new Error(`Ficha sin título: ${product.url}`);
  if (!product.providerId.trim()) throw new Error(`Ficha sin proveedor: ${product.url}`);
  const url = new URL(product.url);
  if (!/^https?:$/.test(url.protocol)) throw new Error(`Ficha con protocolo no permitido: ${product.url}`);
};

export const buildCatalogItems = (products: readonly ProductRecord[]): readonly CatalogItem[] =>
  products.map((product) => {
    const specs = product.specs ? Object.fromEntries(Object.entries(product.specs).sort(([a], [b]) => a.localeCompare(b))) : {};
    return {
      key: buildProductIdentity(product).key,
      fingerprint: digest(JSON.stringify({ ...product, specs }))
    };
  }).sort((a, b) => a.key.localeCompare(b.key));

export const compareCatalog = (previous: CatalogSnapshot | null, current: readonly CatalogItem[]): CatalogChanges => {
  const currentByKey = new Map(current.map((item) => [item.key, item.fingerprint]));
  const previousByKey = new Map(previous?.items.map((item) => [item.key, item.fingerprint]) ?? []);
  return {
    baseline: previous ? "previous" : "new",
    previousCount: previousByKey.size,
    currentCount: currentByKey.size,
    added: [...currentByKey.keys()].filter((key) => !previousByKey.has(key)),
    updated: [...currentByKey.keys()].filter((key) => previousByKey.has(key) && previousByKey.get(key) !== currentByKey.get(key)),
    suspectedMissing: [...previousByKey.keys()].filter((key) => !currentByKey.has(key))
  };
};

export const assessCatalogQuality = (
  results: readonly CategoryScrapeResult[],
  products: readonly ProductRecord[],
  previous: CatalogSnapshot | null
): CatalogQuality => {
  const reasons: string[] = [];
  if (results.length === 0) reasons.push("No hay categorías procesadas");
  if (products.length === 0) reasons.push("Catálogo sin productos válidos");

  for (const result of results) {
    if (result.products.length === 0) reasons.push(`Categoría sin productos: ${result.category.key}`);
    if (result.failures.length > 0) reasons.push(`Errores de extracción en ${result.category.key}: ${result.failures.length}`);
  }

  if (previous && previous.items.length >= 10 && products.length < previous.items.length / 2) {
    reasons.push(`Caída anómala del catálogo: ${previous.items.length} → ${products.length}`);
  }

  const blocked = results.length === 0 || products.length === 0 || results.some((r) => r.products.length === 0)
    || (previous !== null && previous.items.length >= 10 && products.length < previous.items.length / 2);
  const status = blocked ? "blocked" : reasons.length > 0 ? "partial" : "complete";
  return { status, reasons, published: status === "complete" };
};

export const parseCatalogSnapshot = (raw: string, scope: string): CatalogSnapshot => {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !("version" in parsed) || parsed.version !== 1
    || !("scope" in parsed) || parsed.scope !== scope
    || !("createdAt" in parsed) || typeof parsed.createdAt !== "string"
    || !("items" in parsed) || !Array.isArray(parsed.items)
    || !parsed.items.every((item: unknown) => item !== null && typeof item === "object"
      && "key" in item && typeof item.key === "string"
      && "fingerprint" in item && typeof item.fingerprint === "string")) {
    throw new Error("Snapshot de catálogo inválido o de distinto ámbito");
  }
  return parsed as CatalogSnapshot;
};

import { createHash } from "node:crypto";
import { buildProductIdentity } from "./identity.js";
import type { CategoryConfig } from "../contracts/scraping.js";
import type { ProductRecord } from "../contracts/catalog.js";

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

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export const categoryScope = (categories: readonly CategoryConfig[], mode: "flat" | "grouped" = "flat"): string =>
  digest(JSON.stringify({ mode, categories: categories.map(({ key, url }) => ({ key, url })).sort((a, b) =>
    `${a.key}:${a.url}`.localeCompare(`${b.key}:${b.url}`)) })).slice(0, 16);

export const buildCatalogItems = (products: readonly ProductRecord[]): readonly CatalogItem[] =>
  products.map((product) => {
    const specs = product.specs ? Object.fromEntries(Object.entries(product.specs).sort(([a], [b]) => a.localeCompare(b))) : {};
    const { scrapedAt: _scrapedAt, ...stable } = product;
    return {
      key: buildProductIdentity(product).key,
      fingerprint: digest(JSON.stringify({ ...stable, specs }))
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

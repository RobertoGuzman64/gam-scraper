import { createHash } from "node:crypto";
import { buildProductIdentity } from "./identity.js";
import type { CategoryConfig, CategoryScrapeResult } from "../contracts/scraping.js";

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
    const { scrapedAt: _scrapedAt, ...stable } = product;
    return {
      key: buildProductIdentity(product).key,
      fingerprint: digest(JSON.stringify({ ...stable, specs }))
    };
  }).sort((a, b) => a.key.localeCompare(b.key));

const canonicalUrl = (url: string): string => {
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
};

export const findIdentityConflicts = (products: readonly ProductRecord[]): readonly string[] => {
  const byIdentity = new Map<string, ProductRecord>();
  const serialByIdentity = new Map<string, string>();
  const conditionByIdentity = new Map<string, ProductRecord["condition"]>();
  const byUrl = new Map<string, ProductRecord>();
  const bySerial = new Map<string, ProductRecord>();
  const conflicts = new Set<string>();
  const normalize = (value: string | null): string => (value ?? "").trim().toLocaleLowerCase("es");

  for (const product of products) {
    const key = buildProductIdentity(product).key;
    const urlKey = `${normalize(product.providerId)}:${canonicalUrl(product.url)}`;
    const previous = byIdentity.get(key);
    if (previous) {
      if (canonicalUrl(previous.url) !== canonicalUrl(product.url)) {
        conflicts.add(`Identidad ${key} asignada a fichas distintas: ${previous.url} / ${product.url}`);
      }
    } else byIdentity.set(key, product);

    const normalizedSerial = normalize(product.serialNumber);
    const knownSerial = serialByIdentity.get(key);
    if (knownSerial && normalizedSerial && normalizedSerial !== knownSerial) {
      conflicts.add(`Identidad ${key} con números de serie contradictorios`);
    } else if (normalizedSerial && !knownSerial) serialByIdentity.set(key, normalizedSerial);
    const knownCondition = conditionByIdentity.get(key);
    if (knownCondition && product.condition && knownCondition !== product.condition) {
      conflicts.add(`Identidad ${key} con estados de maquinaria contradictorios`);
    } else if (product.condition && !knownCondition) conditionByIdentity.set(key, product.condition);

    const previousUrl = byUrl.get(urlKey);
    if (previousUrl && previousUrl.reference && product.reference &&
      normalize(previousUrl.reference) !== normalize(product.reference)) {
      conflicts.add(`Ficha ${product.url} con referencias contradictorias`);
    } else if (!previousUrl) byUrl.set(urlKey, product);

    const serial = normalize(product.serialNumber);
    if (serial) {
      const serialKey = `${normalize(product.providerId)}:${serial}`;
      const previousSerial = bySerial.get(serialKey);
      if (previousSerial && previousSerial.reference && product.reference &&
        normalize(previousSerial.reference) !== normalize(product.reference)) {
        conflicts.add(`Número de serie ${serial} asociado a referencias distintas en ${product.providerId}: ${previousSerial.reference} (${previousSerial.url}) / ${product.reference} (${product.url})`);
      } else if (!previousSerial) bySerial.set(serialKey, product);
    }
  }
  return [...conflicts];
};

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
  previous: CatalogSnapshot | null,
  identityConflicts: readonly string[] = []
): CatalogQuality => {
  const reasons: string[] = [...identityConflicts];
  if (results.length === 0) reasons.push("No hay categorías procesadas");
  if (products.length === 0) reasons.push("Catálogo sin productos válidos");

  for (const result of results) {
    if (result.products.length === 0) reasons.push(`Categoría sin productos: ${result.category.key}`);
    if (result.failures.length > 0) reasons.push(`Errores de extracción en ${result.category.key}: ${result.failures.length}`);
    if (result.expectedProductUrls !== undefined && result.discoveredProductUrls !== result.expectedProductUrls) {
      reasons.push(`Cobertura incompleta en ${result.category.key}: ${result.discoveredProductUrls} de ${result.expectedProductUrls} referencias`);
    }
  }

  if (previous && previous.items.length >= 10 && products.length < previous.items.length / 2) {
    reasons.push(`Caída anómala del catálogo: ${previous.items.length} → ${products.length}`);
  }

  const blocked = identityConflicts.length > 0 || results.length === 0 || products.length === 0 || results.some((r) => r.products.length === 0)
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

import type { CanonicalCatalog } from "../canonical-catalog.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import { CAMPAIGN_PROVIDERS, isReferenceProviderSet } from "../../contracts/campaign-providers.js";

export type ReferenceIdentity = {
  readonly identity: string;
  readonly reference: string | null;
  readonly url: string;
};

export type ReferenceFieldValue = { readonly present: boolean; readonly value?: unknown };

export type ReferenceFieldChange = {
  readonly field: string;
  readonly previous: ReferenceFieldValue;
  readonly current: ReferenceFieldValue;
};

export type ReferenceProductChange = ReferenceIdentity & { readonly fields: readonly ReferenceFieldChange[] };

export type ReferenceProviderDifference = {
  readonly providerId: string;
  readonly previousCount: number;
  readonly currentCount: number;
  readonly added: readonly ReferenceIdentity[];
  readonly missing: readonly ReferenceIdentity[];
  readonly modified: readonly ReferenceProductChange[];
  readonly unchanged: number;
};

export type ReferenceComparison = {
  readonly version: 1;
  readonly baseline: "initial" | "previous";
  readonly previousRunId: string | null;
  readonly currentRunId: string;
  readonly providers: readonly ReferenceProviderDifference[];
};

const normalizeReference = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const canonicalUrl = (value: string): string => {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
};

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stable(entry)]));
  }
  return value;
};

const sameValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(stable(left)) === JSON.stringify(stable(right));

const identity = (product: ProductRecord): ReferenceIdentity => {
  const reference = product.reference ? normalizeReference(product.reference) : "";
  const url = canonicalUrl(product.url);
  return {
    identity: reference ? `${product.providerId}:ref:${reference}` : `${product.providerId}:url:${url}`,
    reference: product.reference,
    url: product.url
  };
};

type IndexedProduct = ReferenceIdentity & { readonly product: ProductRecord; readonly canonicalUrl: string };

const indexProducts = (catalog: CanonicalCatalog): Map<string, IndexedProduct> => {
  const indexed = new Map<string, IndexedProduct>();
  const urlOwners = new Map<string, string>();
  for (const product of catalog.products) {
    const item = identity(product);
    const normalizedUrl = canonicalUrl(product.url);
    if (indexed.has(item.identity)) throw new Error(`Identidad de inventario duplicada en ${catalog.providerId}: ${item.identity}`);
    const owner = urlOwners.get(normalizedUrl);
    if (owner) throw new Error(`URL de inventario compartida en ${catalog.providerId}: ${normalizedUrl} (${owner}, ${item.identity})`);
    indexed.set(item.identity, { ...item, product, canonicalUrl: normalizedUrl });
    urlOwners.set(normalizedUrl, item.identity);
  }
  return indexed;
};

const sorted = <T extends ReferenceIdentity>(items: readonly T[]): readonly T[] =>
  [...items].sort((left, right) => left.identity.localeCompare(right.identity));

const fieldValue = (product: ProductRecord, field: string): ReferenceFieldValue => {
  if (field.startsWith("specs.")) {
    const key = field.slice("specs.".length);
    const specs = product.specs;
    if (!specs || !Object.hasOwn(specs, key)) return { present: false };
    return { present: true, value: specs[key] };
  }
  if (!Object.hasOwn(product, field)) return { present: false };
  const value: unknown = Object.entries(product).find(([key]) => key === field)?.[1];
  return { present: true, value };
};

const changesFor = (before: ProductRecord, after: ProductRecord): readonly ReferenceFieldChange[] => {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  fields.delete("scrapedAt");
  fields.delete("specs");
  const beforeSpecs = before.specs ?? {};
  const afterSpecs = after.specs ?? {};
  for (const key of [...Object.keys(beforeSpecs), ...Object.keys(afterSpecs)]) fields.add(`specs.${key}`);
  return [...fields].sort((left, right) => left.localeCompare(right)).flatMap((field) => {
    const previous = fieldValue(before, field);
    const current = fieldValue(after, field);
    const equivalent = field === "url" && previous.present && current.present &&
      typeof previous.value === "string" && typeof current.value === "string"
      ? canonicalUrl(previous.value) === canonicalUrl(current.value)
      : sameValue(previous.value, current.value);
    return previous.present === current.present && equivalent
      ? [] : [{ field, previous, current }];
  });
};

const compareProvider = (
  providerId: string, previous: CanonicalCatalog | null, current: CanonicalCatalog, isNewProvider: boolean
): ReferenceProviderDifference => {
  if (current.providerId !== providerId || (previous && previous.providerId !== providerId)) {
    throw new Error(`Proveedor de inventario incoherente: ${providerId}`);
  }
  if (previous && previous.scope !== current.scope) {
    throw new Error(`Ámbito de extracción no comparable para ${providerId}: ${previous.scope} / ${current.scope}`);
  }
  const before = previous ? indexProducts(previous) : new Map<string, IndexedProduct>();
  const after = indexProducts(current);
  if (!previous) return {
    providerId, previousCount: 0, currentCount: after.size,
    added: isNewProvider ? sorted([...after.values()]).map(({ identity: key, reference, url }) => ({ identity: key, reference, url })) : [],
    missing: [], modified: [], unchanged: 0
  };
  if (previous) {
    const beforeUrls = new Map([...before.values()].map((item) => [item.canonicalUrl, item.identity]));
    const afterUrls = new Map([...after.values()].map((item) => [item.canonicalUrl, item.identity]));
    for (const [url, previousIdentity] of beforeUrls) {
      const currentIdentity = afterUrls.get(url);
      if (currentIdentity && currentIdentity !== previousIdentity) {
        throw new Error(`Identidad contradictoria para ${providerId}: la URL ${url} pasó de ${previousIdentity} a ${currentIdentity}`);
      }
    }
  }
  const added = sorted([...after.values()].filter((item) => !before.has(item.identity)));
  const missing = sorted([...before.values()].filter((item) => !after.has(item.identity)));
  const modified: ReferenceProductChange[] = [];
  let unchanged = 0;
  for (const item of after.values()) {
    const original = before.get(item.identity);
    if (!original) continue;
    const fields = changesFor(original.product, item.product);
    if (fields.length === 0) unchanged += 1;
    else modified.push({ identity: item.identity, reference: item.reference, url: item.url, fields });
  }
  return {
    providerId, previousCount: before.size, currentCount: after.size,
    added: added.map(({ identity: key, reference, url }) => ({ identity: key, reference, url })),
    missing: missing.map(({ identity: key, reference, url }) => ({ identity: key, reference, url })),
    modified: sorted(modified), unchanged
  };
};

export const compareCampaignReferences = (
  previousRunId: string | null,
  previous: readonly CanonicalCatalog[] | null,
  currentRunId: string,
  current: readonly CanonicalCatalog[]
): ReferenceComparison => {
  if (!currentRunId.trim() || (previous === null) !== (previousRunId === null)) {
    throw new Error("Identificación de lotes de comparación inválida");
  }
  const indexCatalogs = (catalogs: readonly CanonicalCatalog[], name: string): Map<string, CanonicalCatalog> => {
    const indexed = new Map<string, CanonicalCatalog>();
    for (const catalog of catalogs) {
      if (indexed.has(catalog.providerId)) throw new Error(`Proveedor duplicado en ${name}: ${catalog.providerId}`);
      indexed.set(catalog.providerId, catalog);
    }
    if ((name === "referencia" && !isReferenceProviderSet([...indexed.keys()])) ||
      (name === "campaña" && (indexed.size !== CAMPAIGN_PROVIDERS.length ||
        CAMPAIGN_PROVIDERS.some((id) => !indexed.has(id))))) {
      throw new Error(`Se necesitan los proveedores completos en ${name}`);
    }
    return indexed;
  };
  const older = previous ? indexCatalogs(previous, "referencia") : null;
  const newer = indexCatalogs(current, "campaña");
  return {
    version: 1, baseline: older ? "previous" : "initial", previousRunId, currentRunId,
    providers: CAMPAIGN_PROVIDERS.map((providerId) => {
      const catalog = newer.get(providerId);
      if (!catalog) throw new Error(`No se encontró el catálogo de ${providerId}`);
      return compareProvider(providerId, older?.get(providerId) ?? null, catalog, older !== null);
    })
  };
};

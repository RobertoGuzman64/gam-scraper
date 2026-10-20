import type { DedupeReason, DedupeReport, ProductRecord } from "../contracts/catalog.js";

type IdentifiableProduct = {
  readonly providerId: string;
  readonly reference: string | null;
  readonly serialNumber: string | null;
  readonly url: string;
};

const normalizeKey = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

export const buildProductIdentity = (product: IdentifiableProduct): { readonly reason: DedupeReason; readonly key: string } => {
  const provider = normalizeKey(product.providerId);
  const reference = (product.reference ?? "").trim();
  if (reference) return { reason: "reference", key: `${provider}:ref:${normalizeKey(reference)}` };

  const serial = (product.serialNumber ?? "").trim();
  if (serial) return { reason: "serialNumber", key: `${provider}:sn:${normalizeKey(serial)}` };

  const url = new URL(product.url);
  url.hash = "";
  url.search = "";
  return { reason: "canonicalUrl", key: `${provider}:url:${url.toString()}` };
};

export const emptyDedupeReport = (): DedupeReport => ({
  kept: 0,
  removed: 0,
  byReason: { reference: 0, serialNumber: 0, canonicalUrl: 0 }
});

export const mergeDedupeReports = (a: DedupeReport, b: DedupeReport): DedupeReport => ({
  kept: a.kept + b.kept,
  removed: a.removed + b.removed,
  byReason: {
    reference: a.byReason.reference + b.byReason.reference,
    serialNumber: a.byReason.serialNumber + b.byReason.serialNumber,
    canonicalUrl: a.byReason.canonicalUrl + b.byReason.canonicalUrl
  }
});

export const dedupeBy = <T>(
  items: readonly T[],
  getEntity: (item: T) => ProductRecord
): { readonly unique: T[]; readonly report: DedupeReport } => {
  const seen = new Set<string>();
  const unique: T[] = [];
  const byReason: Record<DedupeReason, number> = { reference: 0, serialNumber: 0, canonicalUrl: 0 };

  for (const item of items) {
    const k = buildProductIdentity(getEntity(item));
    if (seen.has(k.key)) {
      byReason[k.reason] += 1;
      continue;
    }
    seen.add(k.key);
    unique.push(item);
  }

  return {
    unique,
    report: {
      kept: unique.length,
      removed: items.length - unique.length,
      byReason
    }
  };
};


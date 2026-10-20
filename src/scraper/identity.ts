import type { DedupeReason } from "./types.js";

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

import type { ProductRecord } from "../contracts/catalog.js";

export const validateScrapedProduct = (product: ProductRecord): void => {
  if (!product.title?.trim()) throw new Error(`Ficha sin título: ${product.url}`);
  if (!product.providerId.trim()) throw new Error(`Ficha sin proveedor: ${product.url}`);
  const url = new URL(product.url);
  if (!/^https?:$/.test(url.protocol)) throw new Error(`Ficha con protocolo no permitido: ${product.url}`);
};


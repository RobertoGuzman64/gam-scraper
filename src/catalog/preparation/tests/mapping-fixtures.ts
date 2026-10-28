import assert from "node:assert/strict";
import { prepareProduct } from "../prepare.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

export const catalog = await loadImportCatalog();
export const source = (providerId: string, url: string, title: string, specs: ProductRecord["specs"], price: string | null = "12345"): ProductRecord => ({
  providerId, categoryKey: providerId === "gam" ? "manutencion" : "venta",
  categoryName: "Maquinaria de ocasión", url, title, shortDescription: "Ficha original", longDescription: "Ficha original",
  price, reference: "SAMPLE", brand: "LGMG", model: "S1413EII", year: "2018", location: null,
  country: null, horometer: null, serialNumber: null, condition: "Segunda mano", image: "https://example.com/image.jpg", specs: specs ?? {}
});
const attr = (name: string) => {
  const result = catalog.attributes.find((entry) => entry.name === name);
  assert.ok(result, name);
  return result;
};
export const attrVal = (record: ProductRecord, name: string): string | number | boolean | null =>
  resolveAttributeValue(record, attr(name));
export const categorySlug = (record: ProductRecord): string | undefined => {
  const prepared = prepareProduct(record, catalog);
  return catalog.categories.find((category) => category.id === prepared.product.categorySellID)?.slug;
};
export const gamUrl = (family: string, id: string) => `https://online.gamrentals.com/es/${family}/${id}-jlg`;
export const gomUrl = (family: string, id: string) => `https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/${family}/${id}/`;
export const merUrl = (id: string) => `https://sales.mercaeleva.com/es/for-sale/machine/${id}`;

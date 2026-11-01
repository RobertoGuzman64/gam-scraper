import type { ProductRecord } from "../../../../../contracts/catalog.js";

const normalized = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

export const verifiedGamSourceVariant = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !record.reference || !record.brand || !record.model ||
    typeof record.specs?.["Marca"] !== "string" || typeof record.specs?.["Modelo"] !== "string") return false;
  const brand = normalized(record.brand);
  const model = normalized(record.model);
  if (!brand || !model || brand !== normalized(record.specs["Marca"]) ||
    model !== normalized(record.specs["Modelo"]) ||
    ![record.title, record.shortDescription, record.longDescription].every((value) => {
      const text = normalized(value ?? "");
      return text.includes(brand) && text.includes(model);
    })) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalized(parts[2]).includes(model);
  } catch {
    return false;
  }
};

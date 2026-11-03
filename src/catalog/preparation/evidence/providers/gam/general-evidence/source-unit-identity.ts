import type { ProductRecord } from "../../../../../../contracts/catalog.js";

const normalized = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

const mentionsIdentity = (text: string, brand: string, model: string): boolean => {
  const value = normalized(text);
  return value.includes(normalized(brand)) && value.includes(normalized(model));
};

export const hasGamSourceUnitIdentity = (record: ProductRecord, general: string): boolean => {
  const brand = record.brand;
  const model = record.model;
  if (record.providerId !== "gam" || record.condition !== "Segunda mano" ||
    !["elevacion", "manutencion"].includes(record.categoryKey) ||
    !record.reference || !brand || !model ||
    !record.title || !record.shortDescription || !record.longDescription ||
    typeof record.specs?.Marca !== "string" || typeof record.specs.Modelo !== "string" ||
    normalized(record.specs.Marca) !== normalized(brand) ||
    normalized(record.specs.Modelo) !== normalized(model) ||
    ![record.title, record.shortDescription, record.longDescription, general].every(
      (part) => mentionsIdentity(part, brand, model)
    )) return false;

  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    const slug = path[2];
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" &&
      !url.search && !url.hash && path.length === 3 && path[0] === "es" &&
      Boolean(slug?.startsWith(`${record.reference}-`) &&
        normalized(slug).includes(normalized(brand)) &&
        normalized(slug).includes(normalized(model)));
  } catch {
    return false;
  }
};


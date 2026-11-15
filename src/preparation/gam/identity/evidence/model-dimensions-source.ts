import type { ProductRecord } from "../../../../contracts/catalog.js";

const compact = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");

export const isGamDocumentedYaleDimensionsSource = (record: ProductRecord): boolean => {
  const model = record.model?.trim();
  const brand = record.brand?.trim();
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    record.categoryKey !== "carretillas-nuevas" || !record.reference?.trim() ||
    !model || compact(brand ?? "") !== "yale" ||
    compact(String(record.specs?.Marca ?? "")) !== "yale" ||
    compact(String(record.specs?.Modelo ?? "")) !== compact(model) ||
    record.externalReference && compact(record.externalReference) !== compact(model) ||
    record.specs?.Motorización !== "Diésel" && record.specs?.["Tipo motor"] !== "Diésel") return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" &&
      !url.search && !url.hash && path.length === 3 && path[0] === "es" &&
      path[1] === "carretillas-elevadora-diesel-yale" &&
      path[2]?.startsWith(`${record.reference}-`) === true &&
      compact(path[2] ?? "").includes(compact(model));
  } catch {
    return false;
  }
};

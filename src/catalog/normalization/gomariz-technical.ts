import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";

const meters = (value: SpecsMap[string] | undefined): number | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:[.,]\d+)?)\s*(?:m|metros?)$/i.exec(value.trim());
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const invalidGomarizPlatformHeight = (url: ProductRecord["url"], specs: SpecsMap): boolean => {
  const platform = meters(specs["Altura plataforma"]);
  const working = meters(specs["Altura de trabajo"]);
  if (platform === null || working === null) return false;
  if (platform >= working) return true;
  try {
    const source = new URL(url);
    const path = source.pathname.split("/").filter(Boolean);
    if (source.protocol !== "https:" || !["gomarizrent.com", "www.gomarizrent.com"].includes(source.hostname) ||
      path.length !== 4 || path[0] !== "venta" || path[1] !== "elevacion-y-trabajos-en-altura" ||
      path[2] !== "camion-plataforma") return false;
    const stored = meters(specs["Altura almacenaje"]);
    return stored !== null && platform === stored;
  } catch {
    return false;
  }
};

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

export const verifiedGomarizPlatformHeight = (record: ProductRecord): number | null => {
  if (record.providerId !== "gomariz" ||
    record.title !== "SOCAGE IVECO 35S14 FORSTE 20D SPEED NEUTRA" ||
    record.model !== "35S14 FORSTE 20D SPEED NEUTRA" ||
    !invalidGomarizPlatformHeight(record.url, record.specs ?? {}) ||
    meters(record.specs?.["Altura plataforma"]) !== 3.07 ||
    meters(record.specs?.["Altura almacenaje"]) !== 3.07 ||
    meters(record.specs?.["Altura de trabajo"]) !== 20 ||
    meters(record.specs?.["Alcance lateral"]) !== 9 ||
    String(record.specs?.Capacidad ?? "").replace(/\s/g, "").toLowerCase() !== "230kg") return null;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || !["gomarizrent.com", "www.gomarizrent.com"].includes(url.hostname) ||
      path[0] !== "venta" || path[1] !== "elevacion-y-trabajos-en-altura" ||
      path[2] !== "camion-plataforma" ||
      !/^socage-iveco-35s14-forste-20d-speed-neutra(?:-\d+)?$/.test(path[3] ?? "") ||
      path.length !== 4) return null;
    // https://www.gomarizrent.com/wp-content/uploads/2025/06/FICHA-TECNICA-SOCAGE-FORSTE-20D-SPEED.pdf
    return 17.6;
  } catch {
    return null;
  }
};

import type { ProductRecord } from "../../../contracts/catalog.js";

export const isGamUnitUrl = (original: ProductRecord): boolean => {
  try {
    const url = new URL(original.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" &&
      url.search === "" && url.hash === "" && parts[0] === "es" && parts.length === 3 &&
      original.reference !== null && /^\d+$/u.test(original.reference) &&
      parts[2]?.startsWith(`${original.reference}-`) === true;
  } catch {
    return false;
  }
};


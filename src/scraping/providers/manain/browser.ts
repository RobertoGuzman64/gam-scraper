import type { ScrapeOptions } from "../../../contracts/scraping.js";
import { discoverManainViaCdp } from "./cdp.js";
import type { ManainListingResult } from "./listing.js";
import { ensureManainChromeSession } from "./session.js";

export const discoverManainSaleCatalog = async (
  url: string, options: ScrapeOptions,
  onProgress?: (pages: number, found: number, stage?: string) => void
): Promise<ManainListingResult> => {
  const entry = new URL(url);
  if (entry.protocol !== "https:" || !["manain.com", "www.manain.com"].includes(entry.hostname.toLowerCase()) ||
    !entry.pathname.startsWith("/catalogo/venta/")) throw new Error("Manain: origen no autorizado para descubrir venta");
  if (!Number.isSafeInteger(options.maxPages) || options.maxPages < 1 || options.timeoutMs < 1000 || options.delayMs < 0) {
    throw new Error("Manain: opciones de descubrimiento inválidas");
  }
  return discoverManainViaCdp(await ensureManainChromeSession(), options, onProgress);
};

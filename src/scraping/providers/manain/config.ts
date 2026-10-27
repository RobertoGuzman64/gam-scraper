import type { CategoryConfig, ScrapeOptions } from "../../../contracts/scraping.js";

export const MANAIN_CATEGORIES: readonly CategoryConfig[] = [
  { key: "venta", name: "Maquinaria en venta", url: "https://manain.com/catalogo/venta/" }
];

export const MANAIN_OPTIONS: ScrapeOptions = {
  outDir: "storage/scraped/manain",
  outPrefix: "scrape-manain",
  maxPages: 500,
  stallStopAfter: 2,
  concurrencyPages: 1,
  concurrencyProducts: 3,
  timeoutMs: 30000,
  delayMs: 750,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
};

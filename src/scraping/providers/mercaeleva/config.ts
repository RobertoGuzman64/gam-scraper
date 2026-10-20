import type { CategoryConfig, ScrapeOptions } from "../../../contracts/scraping.js";

export const MERCAELeVA_CATEGORIES: readonly CategoryConfig[] = [
  { key: "venta", name: "Maquinaria en venta", url: "https://sales.mercaeleva.com/es/for-sale" }
];

export const MERCAELeVA_OPTIONS: ScrapeOptions = {
  outDir: "storage/scraped/mercaeleva",
  outPrefix: "scrape-mercaeleva",
  maxPages: 100,
  stallStopAfter: 2,
  concurrencyPages: 1,
  concurrencyProducts: 3,
  timeoutMs: 30000,
  delayMs: 400,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
};

import type { CategoryConfig, ScrapeOptions } from "../../../contracts/scraping.js";

export const GOMARIZ_CATEGORIES: readonly CategoryConfig[] = [
  { key: "venta", name: "Maquinaria de ocasión", url: "https://www.gomarizrent.com/venta/" }
];

export const GOMARIZ_OPTIONS: ScrapeOptions = {
  outDir: "storage/scraped/gomariz",
  outPrefix: "scrape-gomariz",
  maxPages: 100,
  stallStopAfter: 2,
  concurrencyPages: 1,
  concurrencyProducts: 3,
  timeoutMs: 30000,
  delayMs: 400,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
};

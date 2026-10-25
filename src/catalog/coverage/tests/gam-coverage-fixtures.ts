import { readFile } from "node:fs/promises";
import { parseCanonicalCatalog } from "../../canonical-catalog.js";

const historicalCatalog = new URL("../../../../storage/scraped/gam/scrape-gam-marzo-2026-catalog.json", import.meta.url);

export const GAM_MISSING_REFERENCES: ReadonlySet<string> = new Set(["6942", "6948", "6366", "6676"]);

export const readHistoricalGamCoverageCatalog = async () =>
  parseCanonicalCatalog(JSON.parse(await readFile(historicalCatalog, "utf8")));

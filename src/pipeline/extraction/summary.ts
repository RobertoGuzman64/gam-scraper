import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Summary } from "../../contracts/scraping.js";

const isSummary = (value: unknown): value is Summary => {
  if (typeof value !== "object" || value === null || !("totals" in value) ||
      !("quality" in value) || !("startedAt" in value) || !("endedAt" in value)) return false;
  if (typeof value.startedAt !== "string" || typeof value.endedAt !== "string") return false;
  const totals = value.totals;
  const quality = value.quality;
  if (typeof totals !== "object" || totals === null || typeof quality !== "object" || quality === null) return false;
  return "categories" in totals && typeof totals.categories === "number" &&
    "scrapedProductsRaw" in totals && typeof totals.scrapedProductsRaw === "number" &&
    "scrapedProducts" in totals && typeof totals.scrapedProducts === "number" &&
    "failures" in totals && typeof totals.failures === "number" &&
    "status" in quality && (quality.status === "complete" || quality.status === "partial" || quality.status === "blocked") &&
    "reasons" in quality && Array.isArray(quality.reasons) && quality.reasons.every((reason: unknown) => typeof reason === "string");
};

export const readSummary = async (outDir: string, outPrefix: string, startedAt: string): Promise<Summary | null> => {
  try {
    const content = await readFile(resolve(outDir, `${outPrefix}-summary.json`), "utf8");
    const parsed: unknown = JSON.parse(content);
    return isSummary(parsed) && parsed.startedAt === startedAt ? parsed : null;
  } catch {
    return null;
  }
};

export const readFirstFailure = async (outDir: string, outPrefix: string): Promise<string | null> => {
  try {
    const content = await readFile(resolve(outDir, `${outPrefix}-errors.json`), "utf8");
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || !("failures" in parsed) || !Array.isArray(parsed.failures)) return null;
    for (const failure of parsed.failures) {
      if (typeof failure === "object" && failure !== null && "error" in failure && typeof failure.error === "string") return failure.error;
    }
    return null;
  } catch {
    return null;
  }
};


import { parseManainListingResult } from "./listing.js";
import type { ManainListingResult } from "./listing.js";

export const buildManainCensus = (listing: ManainListingResult) => ({
  type: "manain-diagnostic-census",
  generatedAt: new Date().toISOString(),
  providerId: "manain",
  complete: listing.complete,
  published: false,
  pagesVisited: listing.pagesVisited,
  endReason: listing.endReason,
  urlCount: listing.urls.length,
  urls: listing.urls
});

const CENSUS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export const reuseManainCompleteCensus = (
  visible: ManainListingResult, saved: unknown, now = Date.now()
): ManainListingResult | null => {
  if (visible.complete || visible.endReason !== "unverified-single-page" || visible.pagesVisited !== 1 ||
    !saved || typeof saved !== "object") return null;
  if (!("type" in saved) || saved.type !== "manain-diagnostic-census" ||
    !("providerId" in saved) || saved.providerId !== "manain" ||
    !("published" in saved) || saved.published !== false ||
    !("generatedAt" in saved) || typeof saved.generatedAt !== "string" ||
    !("urlCount" in saved) || typeof saved.urlCount !== "number") return null;
  const timestamp = Date.parse(saved.generatedAt);
  if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp > CENSUS_MAX_AGE_MS) return null;
  let stored: ManainListingResult;
  try {
    stored = parseManainListingResult(saved);
  } catch {
    return null;
  }
  if (!stored.complete || stored.endReason !== "control-exhausted" || stored.pagesVisited < 2 ||
    stored.urls.length !== saved.urlCount || visible.urls.length !== stored.urls.length) return null;
  const visibleUrls = new Set(visible.urls);
  if (visibleUrls.size !== stored.urls.length || !stored.urls.every((url) => visibleUrls.has(url))) return null;
  return stored;
};

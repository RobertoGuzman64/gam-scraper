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

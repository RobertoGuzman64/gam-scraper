import type { ManainListingResult } from "./listing.js";

export const MANAIN_SAMPLE_LIMIT = 5;

export type ManainSampleSelection = {
  readonly urls: readonly string[];
  readonly discovered: number;
  readonly pagesVisited: number;
  readonly endReason: ManainListingResult["endReason"];
  readonly complete: false;
  readonly published: false;
};

export const selectManainDiagnosticSample = (listing: ManainListingResult): ManainSampleSelection => {
  if (!listing.urls.length) throw new Error("Manain: no hay fichas para la muestra diagnóstica");
  return {
    urls: listing.urls.slice(0, MANAIN_SAMPLE_LIMIT),
    discovered: listing.urls.length,
    pagesVisited: listing.pagesVisited,
    endReason: listing.endReason,
    complete: false,
    published: false
  };
};

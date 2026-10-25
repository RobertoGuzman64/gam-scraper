import type { ParsedProduct } from "../provider.js";

export type ProductPageCache = Map<string, Promise<ParsedProduct>>;

export type ScrapeProgressCallbacks = {
  readonly verbose: boolean;
  readonly onListingDone: (total: number) => void;
  readonly onListingProgress?: (pages: number, total: number, stage?: string) => void;
  readonly onProductDone: (done: number, total: number) => void;
  readonly onFailure?: (stage: string, url: string, reason: string) => void;
};

export type ScrapeReport = (scope: string, message: string) => void;
export type ScrapeFailureRecorder = (stage: string, url: string, error: string) => void;

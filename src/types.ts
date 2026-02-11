export type CategoryConfig = {
  readonly key: string;
  readonly name: string;
  readonly url: string;
};

export type SpecScalar = string | number | boolean;
export type SpecValue = SpecScalar | readonly SpecScalar[];
export type SpecsMap = Readonly<Record<string, SpecValue>>;

export type ProductRecord = {
  readonly categoryKey: string;
  readonly categoryName: string;
  readonly url: string;
  readonly title: string | null;
  readonly shortDescription: string | null;
  readonly longDescription: string | null;
  readonly price: string | null;
  readonly reference: string | null;
  readonly brand: string | null;
  readonly model: string | null;
  readonly year: string | null;
  readonly location: string | null;
  readonly country: string | null;
  readonly horometer: string | null;
  readonly serialNumber: string | null;
  readonly specs?: SpecsMap;
};

export type ScrapeOptions = {
  readonly outDir: string;
  readonly outPrefix: string;
  readonly maxPages: number;
  readonly stallStopAfter: number;
  readonly concurrencyPages: number;
  readonly concurrencyProducts: number;
  readonly timeoutMs: number;
  readonly delayMs: number;
  readonly userAgent: string;
};

export type CategoryScrapeResult = {
  readonly category: CategoryConfig;
  readonly discoveredProductUrls: number;
  readonly products: readonly ProductRecord[];
  readonly failures: readonly { readonly url: string; readonly error: string }[];
};

export type DedupeReason = "reference" | "serialNumber" | "canonicalUrl";

export type DedupeReport = {
  readonly kept: number;
  readonly removed: number;
  readonly byReason: Readonly<Record<DedupeReason, number>>;
};

export type Summary = {
  readonly startedAt: string;
  readonly endedAt: string;
  readonly totals: {
    readonly categories: number;
    readonly discoveredProductUrls: number;
    readonly scrapedProductsRaw: number;
    readonly scrapedProductsByCategorySum: number;
    readonly scrapedProducts: number;
    readonly failures: number;
    readonly dedupe: {
      readonly withinCategories: DedupeReport;
      readonly globalAll: DedupeReport;
    };
  };
  readonly categories: readonly {
    readonly key: string;
    readonly name: string;
    readonly url: string;
    readonly discoveredProductUrls: number;
    readonly scrapedProductsRaw: number;
    readonly scrapedProducts: number;
    readonly failures: number;
    readonly dedupe: DedupeReport;
  }[];
};